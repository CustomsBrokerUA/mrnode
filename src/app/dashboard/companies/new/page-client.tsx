'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui';
import { createCompany } from '@/actions/companies';
import CustomsTokenInstructionModal from '@/components/customs-token-instruction-modal';

export default function NewCompanyPageClient() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    edrpou: '',
    customsToken: '',
  });
  const [showToken, setShowToken] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Очистити помилку для цього поля
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Назва компанії обов\'язкова';
    }

    if (!formData.edrpou.trim()) {
      newErrors.edrpou = 'ЄДРПОУ обов\'язкове';
    } else if (!/^\d{8}$/.test(formData.edrpou.trim())) {
      newErrors.edrpou = 'ЄДРПОУ має містити рівно 8 цифр';
    }

    if (!formData.customsToken.trim()) {
      newErrors.customsToken = 'Токен митниці обов\'язковий';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSuccess(false);

    try {
      const result = await createCompany({
        name: formData.name.trim(),
        edrpou: formData.edrpou.trim(),
        customsToken: formData.customsToken.trim(),
      });

      if (result.success) {
        setSuccess(true);
        
        // Відправити подію для оновлення CompanySelector в header
        window.dispatchEvent(new CustomEvent('companyUpdated'));
        
        // Перенаправити на сторінку компаній через 1.5 секунди
        setTimeout(() => {
          router.push('/dashboard/companies');
          router.refresh();
        }, 1500);
      } else {
        setErrors({ submit: result.error || 'Помилка створення компанії' });
      }
    } catch (error: any) {
      console.error('Error creating company:', error);
      setErrors({ submit: error.message || 'Помилка створення компанії' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/companies">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Додати компанію
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Створіть нову компанію або відновіть видалену
          </p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-900 dark:text-green-100">
              Компанію успішно створено!
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              Перенаправлення...
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 space-y-6">
        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="name">
            Назва компанії <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Наприклад: ТОВ 'Назва компанії'"
            className={errors.name ? 'border-red-500' : ''}
            disabled={isSubmitting || success}
          />
          {errors.name && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.name}
            </p>
          )}
        </div>

        {/* EDRPOU */}
        <div className="space-y-2">
          <Label htmlFor="edrpou">
            ЄДРПОУ <span className="text-red-500">*</span>
          </Label>
          <Input
            id="edrpou"
            name="edrpou"
            type="text"
            value={formData.edrpou}
            onChange={handleInputChange}
            placeholder="12345678"
            maxLength={8}
            pattern="[0-9]{8}"
            className={errors.edrpou ? 'border-red-500' : ''}
            disabled={isSubmitting || success}
          />
          {errors.edrpou && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.edrpou}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Введіть 8-значний код ЄДРПОУ
          </p>
        </div>

        {/* Customs Token */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="customsToken">
              Токен митниці <span className="text-red-500">*</span>
            </Label>
            <button
              type="button"
              onClick={() => setIsTokenModalOpen(true)}
              className="text-xs text-brand-blue dark:text-brand-teal hover:underline"
            >
              Як отримати токен?
            </button>
          </div>
          <div className="relative">
            <Input
              id="customsToken"
              name="customsToken"
              type={showToken ? 'text' : 'password'}
              value={formData.customsToken}
              onChange={handleInputChange}
              placeholder="Введіть токен доступу до API митниці"
              className={errors.customsToken ? 'border-red-500 pr-10' : 'pr-10'}
              disabled={isSubmitting || success}
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              disabled={isSubmitting || success}
              title={showToken ? 'Приховати токен' : 'Показати токен'}
            >
              {showToken ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.customsToken && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.customsToken}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Токен необхідний для доступу до API митниці та синхронізації даних
          </p>
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-900 dark:text-red-100">
              {errors.submit}
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                Важлива інформація
              </p>
              <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                <li>Якщо компанія з таким ЄДРПОУ вже існує, ви станете її власником</li>
                <li>Якщо компанія була видалена, вона буде відновлена</li>
                <li>Ви автоматично станете власником (OWNER) нової компанії</li>
                <li>Токен митниці буде зашифрований та збережений безпечно</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || success}
            className="flex-1"
          >
            {isSubmitting ? 'Створення...' : success ? 'Створено!' : 'Створити компанію'}
          </Button>
          <Link href="/dashboard/companies">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting || success}
            >
              Скасувати
            </Button>
          </Link>
        </div>
      </form>

      {/* Token Instruction Modal */}
      <CustomsTokenInstructionModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
      />
    </div>
  );
}
