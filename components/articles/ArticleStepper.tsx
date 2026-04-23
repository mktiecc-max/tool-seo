'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { Article, ArticleConfig } from '@/types';
import { cn } from '@/lib/utils';
import Step1Config from './steps/Step1Config';
import Step2Outline from './steps/Step2Outline';
import Step3Generating from './steps/Step3Generating';
import Step4Review from './steps/Step4Review';
import Step5Image from './steps/Step5Image';
import Step6Publish from './steps/Step6Publish';

const STEPS = [
  { label: 'Cấu hình', sub: 'Loại bài & AI model' },
  { label: 'Outline', sub: 'Review & chỉnh sửa' },
  { label: 'Viết bài', sub: 'AI tạo nội dung' },
  { label: 'Review', sub: 'Chỉnh sửa nội dung' },
  { label: 'Ảnh', sub: 'Tạo & chọn ảnh' },
  { label: 'Đăng bài', sub: 'Lên WordPress' },
];

function statusToStep(status: string): number {
  const map: Record<string, number> = {
    configuring: 0,
    generating_outline: 1,
    outline_review: 1,
    generating_content: 2,
    content_review: 3,
    generating_image: 4,
    image_review: 4,
    publishing: 5,
    done: 5,
    failed: 0,
  };
  return map[status] ?? 0;
}

interface Props {
  existingArticle: Article | null;
  initialKeyword?: string;
  initialKeywordId?: string;
  onArticleUpdate: (a: Article) => void;
}

export default function ArticleStepper({
  existingArticle,
  initialKeyword,
  initialKeywordId,
  onArticleUpdate,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [article, setArticle] = useState<Article | null>(existingArticle);

  useEffect(() => {
    if (existingArticle) {
      setArticle(existingArticle);
      setCurrentStep(statusToStep(existingArticle.status));
    }
  }, [existingArticle]);

  const updateArticle = (updated: Article) => {
    setArticle(updated);
    onArticleUpdate(updated);
  };

  const goToStep = (step: number) => {
    if (step <= currentStep || (article && step <= statusToStep(article.status) + 1)) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => setCurrentStep((s) => Math.min(s + 1, 5));

  return (
    <div className="max-w-5xl mx-auto">
      {/* Stepper Header */}
      <div className="flex items-center mb-10">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-center flex-1">
            <button
              onClick={() => goToStep(i)}
              className="flex items-center gap-2.5 group"
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                  i < currentStep
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : i === currentStep
                    ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                    : 'border-gray-700 text-gray-600'
                )}
              >
                {i < currentStep ? <Check size={14} /> : i + 1}
              </div>
              <div className="hidden md:block">
                <p
                  className={cn(
                    'text-sm font-medium leading-tight',
                    i === currentStep ? 'text-white' : i < currentStep ? 'text-blue-400' : 'text-gray-600'
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-gray-600 leading-tight">{step.sub}</p>
              </div>
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight
                size={16}
                className={cn(
                  'mx-2 flex-1',
                  i < currentStep ? 'text-blue-600' : 'text-gray-700'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="glass-card rounded-2xl p-8">
        {currentStep === 0 && (
          <Step1Config
            article={article}
            initialKeyword={initialKeyword}
            initialKeywordId={initialKeywordId}
            onCreated={(a) => { updateArticle(a); nextStep(); }}
          />
        )}
        {currentStep === 1 && article && (
          <Step2Outline
            article={article}
            onConfirmed={(a) => { updateArticle(a); nextStep(); }}
          />
        )}
        {currentStep === 2 && article && (
          <Step3Generating
            article={article}
            onDone={(a) => { updateArticle(a); nextStep(); }}
          />
        )}
        {currentStep === 3 && article && (
          <Step4Review
            article={article}
            onConfirmed={(a) => { updateArticle(a); nextStep(); }}
            onBack={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 4 && article && (
          <Step5Image
            article={article}
            onConfirmed={(a) => { updateArticle(a); nextStep(); }}
          />
        )}
        {currentStep === 5 && article && (
          <Step6Publish
            article={article}
            onPublished={(a) => updateArticle(a)}
          />
        )}
      </div>
    </div>
  );
}
