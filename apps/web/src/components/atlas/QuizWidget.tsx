'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAtlasQuiz } from '../../core/atlas/hooks';
import Callout from './Callout';
import { atlasTrackers } from '../../core/atlas/telemetry';

export default function QuizWidget() {
  const {
    currentQuiz,
    currentIndex,
    selectedAnswer,
    score,
    completed,
    showExplanation,
    startQuiz,
    selectAnswer,
    nextQuestion,
    resetQuiz
  } = useAtlasQuiz();

  if (!currentQuiz && !completed) {
    return (
      <div className="p-6 rounded-2xl border border-border bg-bgElev">
        <div className="text-center space-y-4">
          <div className="text-2xl">🧠</div>
          <h3 className="text-lg font-semibold text-text-primary">Quick Knowledge Check</h3>
          <p className="text-sm text-text-secondary">
            Test your astrological knowledge with a quick quiz!
          </p>
          <button
            onClick={startQuiz}
            className="px-6 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
          >
            Start Quiz
          </button>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 rounded-2xl border border-border bg-bgElev"
      >
        <div className="text-center space-y-4">
          <div className="text-4xl">
            {score >= 4 ? '🎉' : score >= 3 ? '👍' : '📚'}
          </div>
          <h3 className="text-lg font-semibold text-text-primary">Quiz Complete!</h3>
          <div className="text-2xl font-bold text-accent">
            {score}/5
          </div>
          <p className="text-sm text-text-secondary">
            {score >= 4 
              ? 'Excellent! You have a strong grasp of astrological concepts.'
              : score >= 3 
              ? 'Good job! Keep exploring to deepen your knowledge.'
              : 'Keep learning! The Atlas has plenty of resources to help you grow.'
            }
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={resetQuiz}
              className="px-4 py-2 rounded-lg bg-bgElev border border-border text-text-primary hover:bg-border transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={startQuiz}
              className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              New Quiz
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key={currentIndex}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="p-6 rounded-2xl border border-border bg-bgElev space-y-4"
    >
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-text-secondary">
        <span>Question {currentIndex + 1} of 5</span>
        <span>Score: {score}/5</span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-bgElev rounded-full h-2">
        <div 
          className="bg-accent h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / 5) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-text-primary">
          {currentQuiz?.prompt}
        </h3>

        {/* Choices */}
        <ul className="space-y-3">
          {currentQuiz?.choices.map((choice, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedAnswer === idx
                  ? selectedAnswer === currentQuiz.answer
                    ? 'border-success bg-success/10'
                    : 'border-danger bg-danger/10'
                  : 'border-border bg-bgElev hover:bg-border'
              }`}>
                <input
                  type="radio"
                  name="quiz-answer"
                  checked={selectedAnswer === idx}
                  onChange={() => selectAnswer(idx)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedAnswer === idx
                    ? selectedAnswer === currentQuiz.answer
                      ? 'border-success bg-success'
                      : 'border-danger bg-danger'
                    : 'border-border'
                }`}>
                  {selectedAnswer === idx && (
                    <div className="w-2 h-2 rounded-full bg-bg" />
                  )}
                </div>
                <span className="text-sm flex-1">{choice}</span>
              </label>
            </motion.li>
          ))}
        </ul>

        {/* Explanation */}
        <AnimatePresence>
          {showExplanation && currentQuiz && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Callout tone={selectedAnswer === currentQuiz.answer ? 'success' : 'warn'}>
                <div className="space-y-2">
                  <div className="font-medium">
                    {selectedAnswer === currentQuiz.answer ? 'Correct!' : 'Not quite.'}
                  </div>
                  {currentQuiz.explain && (
                    <div className="text-sm">
                      {currentQuiz.explain}
                    </div>
                  )}
                </div>
              </Callout>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Next Button */}
        {selectedAnswer !== null && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="pt-2"
          >
            <button
              onClick={nextQuestion}
              className="w-full px-4 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
            >
              {currentIndex < 4 ? 'Next Question' : 'Finish Quiz'}
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
