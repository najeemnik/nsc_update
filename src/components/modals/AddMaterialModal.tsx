import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Truck, X, Calculator, Building2, CheckCircle, Package } from 'lucide-react';
import { backendApi } from '../../services/backendApi';

interface AddMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMaterialName?: string;
  defaultSupplierId?: string;
}

export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
  isOpen,
  onClose,
  defaultMaterialName,
  defaultSupplierId,
}) => {
  const { currentProject, projects, suppliers, formatCurrency, t, language, tp } = useApp();
  const [projectId, setProjectId] = useState<string>(currentProject?.id || (projects[0]?.id || ''));
  const [materialName, setMaterialName] = useState(defaultMaterialName || '');
  const [category, setCategory] = useState('مصالح عمومی ساختمانی');
  const [quantity, setQuantity] = useState('100');
  const [unitOfMeasure, setUnitOfMeasure] = useState('بوجی (کیسه)');
  const [unitPrice, setUnitPrice] = useState('520');
  const [supplierName, setSupplierName] = useState('شرکت تأمین مصالح ABC');
  const [supplierId, setSupplierId] = useState(defaultSupplierId || '');
  const [isPaid, setIsPaid] = useState(true);
  const [invoiceNo, setInvoiceNo] = useState(`INV-${Date.now().toString().slice(-5)}`);
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const numQty = parseFloat(quantity) || 0;
  const numUnitPrice = parseFloat(unitPrice) || 0;
  const totalCost = numQty * numUnitPrice;

  useEffect(() => {
    if (currentProject) setProjectId(currentProject.id);
    if (defaultMaterialName) setMaterialName(defaultMaterialName);
    setInvoiceNo(`INV-${Date.now().toString().slice(-5)}`);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
  }, [isOpen, currentProject, defaultMaterialName]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!materialName.trim()) {
      setFormError(tp('Material name is required.', 'نام جنس/ماده ساختمانی الزامی است.', 'د ساختماني جنس/مادې نوم اړین دی.'));
      return;
    }
    if (numQty <= 0 || numUnitPrice <= 0) {
      setFormError(tp('Quantity and price must be greater than zero.', 'تعداد و قیمت فی واحد باید بیشتر از صفر باشد.', 'شمېر او د واحد فی بیه باید له صفره زیاته وي.'));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await backendApi.createMaterialProcurement({
        projectId,
        materialName: materialName.trim(),
        materialCategory: category,
        quantity: numQty,
        unitOfMeasure,
        unitPrice: numUnitPrice,
        supplierName: supplierName.trim(),
        supplierId: supplierId || undefined,
        isPaid,
        purchaseDate,
        notes: notes.trim() || undefined,
      });
      if (!res.success) {
        throw new Error(res.error || 'خطا در ثبت خرید مصالح');
      }

      setSuccessNotice(true);
      setTimeout(() => {
        setSuccessNotice(false);
        setIsSubmitting(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت خرید مصالح');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div 
        className="relative w-full max-w-xl bg-surface border border-line rounded-3xl shadow-2xl overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-line bg-gradient-to-r from-amber-600/10 via-orange-600/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-ink">
                {tp('Material Purchase & Procurement', 'ثبت و تدارکات خرید مصالح (تعداد × فی)', 'د مصالحو د پېر ثبت او تدارکات (شمېر × فی)')}
              </h2>
              <p className="text-xs text-ink-muted">
                {tp('Auto-calculated Total Cost connected to Actual Cost', 'محاسبه خودکار سرجمع و اتصال مستقیم به مصارف و تأمین‌کننده', 'د سرجمع اوتومات محاسبه او له مصارفو او عرضه کوونکي سره مستقیمه نښلول')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-ink rounded-xl hover:bg-surface-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold">
              {formError}
            </div>
          )}

          {successNotice && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{tp('Material purchase logged successfully!', 'خرید مصالح با موفقیت ثبت و در مصارف پروژه اعمال گردید!', 'د مصالحو پېر په بریالیتوب ثبت او د پروژې په مصارفو کې ولګول شو!')}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Project */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('project') || 'Project'}
              </label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {tp('Category', 'دسته‌بندی مواد', 'د موادو ډلبندي')}
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                <option value="سیمان و مواد چسباننده">{tp('Cement & Binders', 'سیمان و مواد چسباننده', 'سمنټ او نښلوونکي مواد')}</option>
                <option value="ریگ، جغل و سنگ‌دانه">{tp('Sand, Gravel & Aggregates', 'ریگ، جغل و سنگ‌دانه', 'شګه، جغل او ډبرې')}</option>
                <option value="خشت و بلاک ساختمانی">{tp('Bricks & Blocks', 'خشت و بلاک ساختمانی', 'خښتې او ساختماني بلاکونه')}</option>
                <option value="پایپ‌دوانی و تأسیسات آب">{tp('Plumbing & Pipes', 'پایپ‌دوانی و تأسیسات آب', 'پایپ غځول او د اوبو تاسیسات')}</option>
                <option value="تأسیسات برقی و کیبل">{tp('Electrical & Wiring', 'تأسیسات برقی و کیبل', 'برېښنايي تاسیسات او کېبل')}</option>
                <option value="گچ، رنگ و نازک‌کاری">{tp('Plaster, Paint & Finishing', 'گچ، رنگ و نازک‌کاری', 'ګچ، رنګ او نازک کاري')}</option>
                <option value="تجهیزات و مصالح متفرقه">{tp('Other Building Materials', 'تجهیزات و مصالح متفرقه', 'متفرقه تجهیزات او مصالح')}</option>
              </select>
            </div>
          </div>

          {/* Material Name */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {tp('Material Description', 'نام مشخص جنس / مواد', 'د جنس / موادو ځانګړی نوم')}
            </label>
            <div className="relative">
              <Package className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={materialName}
                onChange={e => setMaterialName(e.target.value)}
                placeholder={tp('e.g. Portland Cement Grade 1', 'مثلاً: سیمان پرتلند غوری درجه یک', 'بېلګه: لومړۍ درجه غوري پورټلنډ سمنټ')}
                className="w-full ps-9 pe-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
          </div>

          {/* Quantity, Unit & Unit Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {tp('Quantity', 'تعداد / مقدار (Qty)', 'شمېر / مقدار (Qty)')}
              </label>
              <input
                type="number"
                step="any"
                required
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-ink font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {tp('Unit', 'واحد اندازه‌گیری', 'د اندازه واحد')}
              </label>
              <select
                value={unitOfMeasure}
                onChange={e => setUnitOfMeasure(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-ink font-semibold"
              >
                <option value="بوجی (کیسه)">بوجی / کیسه (Bags)</option>
                <option value="تن (Tons)">تن (Tons)</option>
                <option value="متر مکعب (m³)">متر مکعب (m³)</option>
                <option value="عدد (Pieces)">عدد (Pieces)</option>
                <option value="متر طول (Meters)">متر طول (Meters)</option>
                <option value="موتر / لاری (Trucks)">موتر / لاری (Trucks)</option>
                <option value="کیلوگرم (Kg)">کیلوگرم (Kg)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {tp('Unit Price (AFN)', 'قیمت فی واحد (AFN)', 'د واحد فی بیه (AFN)')}
              </label>
              <input
                type="number"
                step="any"
                required
                value={unitPrice}
                onChange={e => setUnitPrice(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-ink font-mono font-bold text-emerald-600"
              />
            </div>
          </div>

          {/* Auto-Calculated Formula Banner (MBA spec: Qty × Unit Cost = Total Cost) */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Calculator className="w-4 h-4 shrink-0" />
              <span className="font-bold">
                {tp('Formula: ', 'فرمول محاسبه سرجمع: ', 'د سرجمع د محاسبې فورمول:')} 
                <span className="font-mono">{numQty} {unitOfMeasure} × {numUnitPrice.toLocaleString()} AFN</span>
              </span>
            </div>
            <div className="text-end">
              <span className="text-[10px] text-slate-400 block">{tp('Total Cost:', 'مجموع بهای کل:', 'د ټولټال بیې مجموعه:')}</span>
              <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                {totalCost.toLocaleString()} AFN
              </span>
            </div>
          </div>

          {/* Supplier & Settlement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {tp('Supplier', 'تأمین‌کننده / فروشنده', 'عرضه کوونکی / پلورونکی')}
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  placeholder="نام شرکت یا دکان فروشنده"
                  className="w-full ps-9 pe-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {tp('Settlement Status', 'وضعیت تسویه مالی', 'د مالي تسویې وضعیت')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaid(true)}
                  className={`flex-1 py-2 rounded-xl font-bold transition ${
                    isPaid ? 'bg-emerald-600 text-white shadow-xs' : 'bg-surface-2 text-slate-500'
                  }`}
                >
                  {tp('Paid (Cash)', 'پرداخت نقدی (کسر از صندوق)', 'نغده تادیه (له صندوق څخه کسرول)')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaid(false)}
                  className={`flex-1 py-2 rounded-xl font-bold transition ${
                    !isPaid ? 'bg-amber-600 text-white shadow-xs' : 'bg-surface-2 text-slate-500'
                  }`}
                >
                  {tp('Credit / Payable', 'نسیه (طلب تأمین‌کننده)', 'پور (د عرضه کوونکي طلب)')}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {tp('Invoice Number', 'شماره بل', 'د بل نمبر')}
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-ink font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('date') || 'Purchase Date'}
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-ink font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('notes') || 'Notes'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="توضیحات تکمیلی، محل تخلیه بار در کارگاه یا شماره موتر..."
              className="w-full px-3.5 py-2 bg-surface-2 border border-line rounded-xl text-ink"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-surface-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition"
            >
              {t('cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black shadow-lg shadow-amber-500/25 transition active:scale-95 disabled:opacity-50"
            >
              <Truck className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت خرید و صدور سند مصالح'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
