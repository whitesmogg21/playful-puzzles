import { useState, useMemo, useEffect } from "react";
import { QBank, QuizHistory, QuestionFilter } from "../types/quiz";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import CircularProgress from "./CircularProgress";
import { useNavigate } from "react-router-dom";

interface DashboardProps {
  qbanks: QBank[];
  quizHistory: QuizHistory[];
  onStartQuiz: (qbankId: string, questionCount: number, tutorMode: boolean, timerEnabled: boolean, timeLimit: number) => void;
}

interface CategoryStats {
  label: string;
  count: number;
  color: string;
  bgColor: string;
  key: keyof QuestionFilter;
}

const Dashboard = ({ qbanks, quizHistory, onStartQuiz }: DashboardProps) => {
  const navigate = useNavigate();
  const [selectedQBank, setSelectedQBank] = useState<QBank | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [tutorMode, setTutorMode] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timeLimit, setTimeLimit] = useState(60);
  const [filters, setFilters] = useState<QuestionFilter>({
    unused: false,
    used: false,
    incorrect: false,
    correct: false,
    marked: false,
    omitted: false,
  });

  useEffect(() => {
    const storedQBank = localStorage.getItem('selectedQBank');
    if (storedQBank) {
      const qbankData = JSON.parse(storedQBank);
      const foundQBank = qbanks.find(qb => qb.id === qbankData.id);
      if (foundQBank) {
        setSelectedQBank(foundQBank);
      }
    }
  }, [qbanks]);

  const metrics = useMemo(() => {
    const seenQuestionIds = new Set<number>();
    const correctQuestionIds = new Set<number>();
    const incorrectQuestionIds = new Set<number>();
    const omittedQuestionIds = new Set<number>();
    const markedQuestionIds = new Set<number>();
    
    quizHistory.forEach(quiz => {
      quiz.questionAttempts.forEach(attempt => {
        seenQuestionIds.add(attempt.questionId);
        
        if (attempt.selectedAnswer === null) {
          incorrectQuestionIds.add(attempt.questionId);
          omittedQuestionIds.add(attempt.questionId);
        } else if (attempt.isCorrect) {
          correctQuestionIds.add(attempt.questionId);
        } else {
          incorrectQuestionIds.add(attempt.questionId);
        }
      });
    });

    const totalQuestions = qbanks.reduce((acc, qbank) => 
      acc + qbank.questions.length, 0);

    const unusedCount = qbanks.reduce((acc, qbank) => 
      acc + qbank.questions.filter(q => !seenQuestionIds.has(q.id)).length, 0);

    if (quizHistory.length > 0) {
      const lastQuiz = quizHistory[quizHistory.length - 1];
      qbanks.forEach(qbank => {
        qbank.questions.forEach(question => {
          if (question.isMarked) {
            markedQuestionIds.add(question.id);
          }
        });
      });
    }

    return {
      unused: unusedCount,
      used: seenQuestionIds.size,
      correct: correctQuestionIds.size,
      incorrect: incorrectQuestionIds.size,
      marked: markedQuestionIds.size,
      omitted: omittedQuestionIds.size,
    };
  }, [qbanks, quizHistory]);

  const overallAccuracy = useMemo(() => {
    const totalAttempted = metrics.correct + metrics.incorrect;
    return totalAttempted > 0 ? (metrics.correct / totalAttempted) * 100 : 0;
  }, [metrics]);

  const categories: CategoryStats[] = [
    {
      label: "Unused",
      count: metrics.unused,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      key: "unused"
    },
    {
      label: "Used",
      count: metrics.used,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      key: "used"
    },
    {
      label: "Incorrect",
      count: metrics.incorrect,
      color: "text-red-600",
      bgColor: "bg-red-50",
      key: "incorrect"
    },
    {
      label: "Correct",
      count: metrics.correct,
      color: "text-green-600",
      bgColor: "bg-green-50",
      key: "correct"
    },
    {
      label: "Marked",
      count: metrics.marked,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      key: "marked"
    },
    {
      label: "Omitted",
      count: metrics.omitted,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      key: "omitted"
    },
  ];

  const chartData = quizHistory.map((quiz, index) => ({
    quizNumber: index + 1,
    score: (quiz.score / quiz.totalQuestions) * 100,
    date: quiz.date,
  }));

  const filteredQBanks = useMemo(() => {
    if (!Object.values(filters).some(Boolean)) return qbanks;

    return qbanks.map(qbank => ({
      ...qbank,
      questions: qbank.questions.filter(question => {
        const attempts = quizHistory.flatMap(quiz => 
          quiz.questionAttempts.filter(attempt => attempt.questionId === question.id)
        );
        
        const isUsed = attempts.length > 0;
        const isCorrect = attempts.some(attempt => attempt.isCorrect);
        const isIncorrect = attempts.some(attempt => !attempt.isCorrect);
        const isOmitted = attempts.some(attempt => attempt.selectedAnswer === null);

        return (
          (filters.unused && !isUsed) ||
          (filters.used && isUsed) ||
          (filters.correct && isCorrect) ||
          (filters.incorrect && isIncorrect) ||
          (filters.marked && question.isMarked) ||
          (filters.omitted && isOmitted)
        );
      })
    })).filter(qbank => qbank.questions.length > 0);
  }, [qbanks, quizHistory, filters]);

  const handleStartQuiz = () => {
    if (selectedQBank && questionCount > 0) {
      if (questionCount > filteredQBanks.find(qb => qb.id === selectedQBank.id)?.questions.length!) {
        toast({
          title: "Invalid Question Count",
          description: "The selected number of questions exceeds the available questions in the filtered set.",
          variant: "destructive"
        });
        return;
      }
      onStartQuiz(selectedQBank.id, questionCount, tutorMode, timerEnabled, timeLimit);
    }
  };

  const toggleFilter = (key: keyof QuestionFilter) => {
    setFilters(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleQBankSelection = () => {
    navigate('/qbanks');
  };

  const handleUnlockQBank = () => {
    setSelectedQBank(null);
    localStorage.removeItem('selectedQBank'); // Clear from localStorage when unlocking
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.label}
              onClick={() => toggleFilter(category.key)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-full transition-all",
                category.bgColor,
                category.color,
                filters[category.key] && "ring-2 ring-offset-2",
                "hover:opacity-90"
              )}
            >
              <Check 
                className={cn(
                  "w-4 h-4",
                  filters[category.key] ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="font-medium">{category.label}</span>
              <span className="px-2 py-0.5 bg-white rounded-full text-sm">
                {category.count}
              </span>
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 flex items-center justify-center">
            <CircularProgress percentage={overallAccuracy} />
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="quizNumber" 
                  label={{ value: 'Quiz Number', position: 'bottom' }}
                />
                <YAxis 
                  label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Score']}
                  labelFormatter={(label) => `Quiz ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#8884d8"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <h2 className="text-xl font-bold">Available Question Banks</h2>
          <div className="grid gap-4">
            <Card
              className={`p-4 cursor-pointer transition-colors ${
                selectedQBank ? "border-primary border-2" : "hover:border-primary/50"
              }`}
              onClick={selectedQBank ? handleUnlockQBank : handleQBankSelection}
              onDoubleClick={selectedQBank ? handleUnlockQBank : undefined}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold">
                    {selectedQBank ? selectedQBank.name : "Select QBank"}
                  </h3>
                  {selectedQBank && (
                    <p className="text-sm text-gray-600">
                      {selectedQBank.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <h2 className="text-xl font-bold">Quiz Configuration</h2>
          <div className="space-y-4">
            <div>
              <Label className="block text-sm font-medium mb-2">
                Number of Questions
              </Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="tutor-mode"
                checked={tutorMode}
                onCheckedChange={setTutorMode}
              />
              <Label htmlFor="tutor-mode">Enable Tutor Mode</Label>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="timer-mode"
                  checked={timerEnabled}
                  onCheckedChange={setTimerEnabled}
                />
                <Label htmlFor="timer-mode">Enable Timer</Label>
              </div>
              {timerEnabled && (
                <div className="space-y-2">
                  <Label>Time per Question (seconds): {timeLimit}</Label>
                  <Slider
                    value={[timeLimit]}
                    onValueChange={(value) => setTimeLimit(value[0])}
                    min={10}
                    max={300}
                    step={10}
                    className="w-full"
                  />
                </div>
              )}
            </div>
            <Button
              onClick={handleStartQuiz}
              disabled={!selectedQBank || questionCount <= 0}
              className="w-full"
            >
              Start Quiz
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
