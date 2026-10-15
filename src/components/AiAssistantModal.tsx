import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { answerProjectQuestionLocally, ProjectContextSummary } from '../services/aiAssistantService';
import { authorizedProjects, effectiveAiProject, type AiDenyReason } from '../utils/aiGovernance';

const DENY_TEXT: Record<AiDenyReason, [string, string, string]> = {
  global_off: ['AI is disabled for the whole system by the master.', 'هوش مصنوعی توسط مالک ارشد برای کل سیستم خاموش است.', 'مصنوعي ځیرکتیا د مشر خاوند لخوا د ټول سیسټم لپاره بنده ده.'],
  visibility: ['AI is not available for your account type.', 'هوش مصنوعی برای نوع حساب شما فعال نیست.', 'مصنوعي ځیرکتیا ستاسو د حساب لپاره فعاله نه ده.'],
  user_off: ['AI is disabled for your account. Contact your administrator.', 'هوش مصنوعی برای حساب شما خاموش است. با مدیر تماس بگیرید.', 'مصنوعي ځیرکتیا ستاسو لپاره بنده ده. له مدیر سره اړیکه ونیسئ.'],
  daily_limit: ['Daily AI limit reached. Try again tomorrow.', 'سقف روزانه هوش مصنوعی تمام شد. فردا تلاش کنید.', 'د مصنوعي ځیرکتیا ورځنی حد پای ته ورسېد. سبا هڅه وکړئ.'],
  monthly_limit: ['Monthly AI limit reached. Contact your administrator.', 'سقف ماهانه هوش مصنوعی تمام شد. با مدیر تماس بگیرید.', 'د مصنوعي ځیرکتیا میاشتنی حد پای ته ورسېد. له مدیر سره اړیکه ونیسئ.'],
};

export const AiAssistantModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const {
    currentUser, currentProject, projects, steelRecords, concreteRecords, expenses, apartments,
    t, tp, language, aiAccess, recordAiUse, trackFeature,
  } = useApp();
  const greeting = tp(
    'Hello! I am your project AI assistant. Ask about steel usage, concrete volume, expenses, debts or apartment sales.',
    'سلام! من دستیار هوش مصنوعی پروژه شما هستم. می‌توانید درباره میزان مصرف سیخ، حجم کانکریت، وضعیت مصارف، طلبکاری‌ها یا فروش اپارتمان‌ها از من بپرسید.',
    'سلام! زه ستاسو د پروژې د مصنوعي ځیرکتیا مرستیال یم. د سیخ لګښت، د کانکریټو حجم، مصارف، پورونه یا د اپارتمانونو پلور په اړه پوښتنه وکړئ.',
  );
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string }>>([]);
  const [loading, setLoading] = useState(false);

  // Wave 34: seed greeting per open (follows the active language), track the session.
  useEffect(() => {
    if (isOpen) {
      setMessages([{
        sender: 'ai',
        text: greeting,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      setQuestion('');
      trackFeature('ai_assistant_open');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // Wave 34: governance — single choke point + authorized scope (req 9).
  const access = aiAccess();
  const scope = authorizedProjects(currentUser, projects);
  // Prefer the user's current project when it lies inside the authorized scope.
  const effProject = effectiveAiProject(currentUser, projects, currentProject?.id);

  const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!access.allowed) {
    const [en, fa, ps] = DENY_TEXT[access.reason || 'user_off'];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
        <div className="bg-slate-900 text-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-700 overflow-hidden p-6 text-center space-y-4 animate-in fade-in zoom-in-95">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-rose-500/15 text-rose-400 border border-rose-500/40 flex items-center justify-center">
            <Bot className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-sm">{t.aiAssistantTitle}</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {language === 'ps' ? ps : language === 'fa' ? fa : en}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-2xl text-xs transition-colors"
          >
            {tp('Close', 'بستن', 'تړل')}
          </button>
        </div>
      </div>
    );
  }

  if (!effProject) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
        <div className="bg-slate-900 text-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-700 overflow-hidden p-6 text-center space-y-4 animate-in fade-in zoom-in-95">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-amber-500/15 text-amber-400 border border-amber-500/40 flex items-center justify-center">
            <Bot className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-sm">{t.aiAssistantTitle}</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {tp('No authorized projects for your account yet. Ask your administrator to grant access.',
              'هنوز هیچ پروژهٔ مجازی برای حساب شما تعیین نشده. از مدیر دسترسی بخواهید.',
              'ستاسو حساب ته تر اوسه هېڅ مجازه پروژه نه ده ټاکل شوې. له مدیر څخه لاسرسی وغواړئ.')}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-2xl text-xs transition-colors"
          >
            {tp('Close', 'بستن', 'تړل')}
          </button>
        </div>
      </div>
    );
  }

  const pid = effProject.id;
  const projectSteel = steelRecords.filter(s => s.projectId === pid);
  const totalSteelTons = projectSteel.reduce((acc, s) => acc + s.tons, 0);
  const steelCostUSD = projectSteel.reduce((acc, s) => acc + s.totalAmount, 0);

  const projectConcrete = concreteRecords.filter(c => c.projectId === pid);
  const totalConcreteM3 = projectConcrete.reduce((acc, c) => acc + c.quantityM3, 0);
  const concreteCostUSD = projectConcrete.reduce((acc, c) => acc + c.totalAmount, 0);

  const projectExpenses = expenses.filter(e => e.projectId === pid);
  const totalExpensesUSD = projectExpenses.reduce((acc, e) => acc + (e.amountInUSD || e.amount), 0);
  const totalPaidUSD = projectExpenses.reduce((acc, e) => acc + (e.paidAmount || 0), 0);
  const totalDebtUSD = projectExpenses.reduce((acc, e) => acc + (e.remainingAmount || 0), 0);

  const projectApartments = apartments.filter(a => a.projectId === pid);
  const apartmentsTotal = projectApartments.length;
  const apartmentsSold = projectApartments.filter(a => a.status === 'sold').length;
  const apartmentsAvailable = projectApartments.filter(a => a.status === 'available').length;
  const totalSalesValueUSD = projectApartments.filter(a => a.status === 'sold').reduce((acc, a) => acc + (a.salePrice || 0), 0);
  const salesReceivedUSD = projectApartments.filter(a => a.status === 'sold').reduce((acc, a) => acc + ((a.salePrice || 0) - (a.remainingBalance || 0)), 0);
  const salesDueUSD = projectApartments.filter(a => a.status === 'sold').reduce((acc, a) => acc + (a.remainingBalance || 0), 0);

  const summary: ProjectContextSummary = {
    projectName: effProject.name,
    totalSteelTons,
    steelCostUSD,
    totalConcreteM3,
    concreteCostUSD,
    totalExpensesUSD,
    totalPaidUSD,
    totalDebtUSD,
    apartmentsTotal,
    apartmentsSold,
    apartmentsAvailable,
    totalSalesValueUSD,
    salesReceivedUSD,
    salesDueUSD,
  };

  const scopedProjects = scope.map(p => ({ name: p.name, floors: p.floors, units: p.units ?? 0, city: p.city }));

  const pushAi = (text: string) => {
    setMessages(prev => [...prev, { sender: 'ai', text, time: stamp() }]);
  };

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || question).trim();
    if (!query || loading) return;
    // Re-check at send time: limits may have been hit mid-session.
    const live = aiAccess();
    if (!live.allowed) {
      const [en, fa, ps] = DENY_TEXT[live.reason || 'user_off'];
      pushAi(language === 'ps' ? ps : language === 'fa' ? fa : en);
      return;
    }
    setMessages(prev => [...prev, { sender: 'user' as const, text: query, time: stamp() }]);
    setQuestion('');
    setLoading(true);
    setTimeout(() => {
      recordAiUse();
      pushAi(answerProjectQuestionLocally(query, summary, scopedProjects));
      setLoading(false);
    }, 350);
  };

  const quickPrompts = language === 'ps'
    ? ['تر اوسه مو څومره سیخ اخیستی؟', 'د کانکریټو اچونه څنګه ده؟', 'څو اپارتمانه پلورل شوي؟', 'اوسني پورونه څومره دي؟']
    : language === 'fa'
      ? ['چقدر سیخ تا حالا خریدیم؟', 'وضعیت کانکریت‌ریزی چطور است؟', 'چند واحد اپارتمان فروخته شده؟', 'طلبکاری‌ها و بدهی‌های فعلی چقدر است؟']
      : ['How much steel bought so far?', 'How is the concrete pouring going?', 'How many apartment units sold?', 'What are the current debts?'];

  const quota = (used: number, max: number): string => (max > 0 ? `${used}/${max}` : `${used}/∞`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-700 overflow-hidden flex flex-col h-[650px] max-h-[90vh] animate-in fade-in zoom-in-95">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">{t.aiAssistantTitle}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {tp('Active project:', 'پروژه فعال:', 'فعاله پروژه:')} <strong className="text-amber-400">{effProject.name}</strong>
                <span className="text-slate-500"> · {tp('today', 'امروز', 'نن')} {quota(access.usedToday, access.dailyMax)} · {tp('month', 'ماه', 'میاشت')} {quota(access.usedMonth, access.monthlyMax)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-3 bg-slate-800/60 border-b border-slate-800 flex gap-2 overflow-x-auto scroll-touch no-scrollbar text-xs">
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(prompt)}
              className="whitespace-nowrap px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors shrink-0 text-[11px] font-medium"
            >
              💬 {prompt}
            </button>
          ))}
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.sender === 'ai' && (
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed whitespace-pre-line ${
                m.sender === 'user'
                  ? 'bg-amber-600 text-white rounded-te-xs shadow-md'
                  : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-ts-xs'
              }`}>
                <p>{m.text}</p>
                <span className={`block text-[9px] mt-1.5 ${m.sender === 'user' ? 'text-amber-200 text-end' : 'text-slate-400'}`}>
                  {m.time}
                </span>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-2 px-3 bg-slate-800/50 rounded-2xl w-fit">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>{t.aiThinking}</span>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t.askAiPlaceholder}
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-2xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
          <button
            type="submit"
            disabled={!question.trim() || loading}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold rounded-2xl text-xs flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
          >
            <span>{tp('Send', 'ارسال', 'واستوه')}</span>
            <Send className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </form>
      </div>
    </div>
  );
};
