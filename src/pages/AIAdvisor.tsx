import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrainCircuit, Send, Loader2, User, Sparkles, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Badge } from '@/components/ui/badge';

type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
};

const SYSTEM_PROMPT = `Kamu adalah Asisten Bisnis AI yang cerdas untuk aplikasi Penawaran & Faktur. Tugasmu adalah membantu pengguna dengan:
1. Analisis bisnis berdasarkan data penawaran dan faktur mereka
2. Saran strategi harga dan penawaran
3. Tips meningkatkan cash flow dan pengelolaan piutang
4. Rekomendasi untuk meningkatkan konversi penawaran
5. Saran umum bisnis dan keuangan

Jawab dalam Bahasa Indonesia dengan bahasa yang profesional namun mudah dipahami.
Jika pengguna bertanya tentang data spesifik, jelaskan bahwa kamu bisa memberikan saran umum berdasarkan praktik bisnis terbaik.
Gunakan emoji secukupnya untuk membuat percakapan lebih menarik. Format jawaban dengan markdown.`;

const AIAdvisor = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [businessStats, setBusinessStats] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchStats = async () => {
            if (!user) return;
            const [quotesRes, invoicesRes, expensesRes] = await Promise.all([
                supabase.from('quotes').select('status').eq('user_id', user.id),
                supabase.from('invoices').select('status').eq('user_id', user.id),
                supabase.from('expenses').select('amount').eq('user_id', user.id),
            ]);

            const quotes = quotesRes.data || [];
            const invoices = invoicesRes.data || [];
            const expenses = expensesRes.data || [];

            setBusinessStats({
                totalQuotes: quotes.length,
                acceptedQuotes: quotes.filter(q => q.status === 'Diterima').length,
                totalInvoices: invoices.length,
                paidInvoices: invoices.filter(i => i.status === 'Lunas').length,
                overdueInvoices: invoices.filter(i => i.status === 'Jatuh Tempo').length,
                totalExpenses: expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
            });
        };
        fetchStats();
    }, [user]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const suggestedQuestions = [
        '📊 Bagaimana cara meningkatkan konversi penawaran?',
        '💰 Tips mengelola cash flow untuk bisnis kecil',
        '📋 Bagaimana cara membuat syarat pembayaran yang efektif?',
        '🎯 Strategi pricing yang tepat untuk jasa',
    ];

    const handleSend = async (messageText?: string) => {
        const text = messageText || input.trim();
        if (!text) return;

        const userMessage: Message = { role: 'user', content: text };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            // Build context with business stats
            let contextMessage = SYSTEM_PROMPT;
            if (businessStats) {
                contextMessage += `\n\nData ringkasan bisnis pengguna:
- Total Penawaran: ${businessStats.totalQuotes} (Diterima: ${businessStats.acceptedQuotes})
- Rasio Penerimaan: ${businessStats.totalQuotes > 0 ? Math.round(businessStats.acceptedQuotes / businessStats.totalQuotes * 100) : 0}%
- Total Faktur: ${businessStats.totalInvoices} (Lunas: ${businessStats.paidInvoices}, Jatuh Tempo: ${businessStats.overdueInvoices})
- Total Pengeluaran: Rp ${businessStats.totalExpenses.toLocaleString('id-ID')}`;
            }

            // Use Supabase Edge Function for AI
            const { data, error } = await supabase.functions.invoke('ai-advisor', {
                body: {
                    messages: [
                        { role: 'system', content: contextMessage },
                        ...newMessages.map(m => ({ role: m.role, content: m.content })),
                    ],
                },
            });

            if (error) throw error;

            const assistantMessage: Message = {
                role: 'assistant',
                content: data?.reply || 'Maaf, saya tidak bisa memproses permintaan Anda saat ini. Silakan coba lagi.',
            };
            setMessages([...newMessages, assistantMessage]);
        } catch (err) {
            console.error('AI Advisor error:', err);
            setMessages([...newMessages, {
                role: 'assistant',
                content: '⚠️ Maaf, terjadi kesalahan saat menghubungi AI. Pastikan fungsi AI sudah dikonfigurasi di Supabase Edge Functions. Untuk sementara, Anda bisa menggunakan saran cepat di bawah ini.',
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8 animate-in zoom-in duration-700">
            <Card className="max-w-4xl mx-auto glass-card bg-background-dark/80 border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent animate-pulse"></div>
                <CardHeader className="border-b border-white/5 pb-8">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3">
                                <BrainCircuit className="h-7 w-7 text-electric-indigo glow-lime" />
                                <CardTitle className="text-3xl font-black text-white tracking-tighter uppercase italic">Neural Processing <span className="text-electric-indigo">Core</span></CardTitle>
                            </div>
                            <CardDescription className="text-slate-400 font-medium tracking-tight">Advanced cognitive business heuristics & predictive synthesis.</CardDescription>
                        </div>
                        {businessStats && (
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Global Accuracy</span>
                                    <span className="text-lg font-black text-cyber-lime tracking-tighter">98.4%</span>
                                </div>
                                <div className="w-[1px] h-8 bg-white/10 mx-2"></div>
                                <div className="hidden md:flex flex-col items-center gap-1.5">
                                    <Badge variant="outline" className="text-[9px] font-black bg-white/5 border-white/10 text-slate-300">
                                        SENSORS ON
                                    </Badge>
                                    <div className="size-1.5 rounded-full bg-cyber-lime animate-pulse"></div>
                                </div>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[450px] rounded-md border p-4" ref={scrollRef}>
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                                <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <Sparkles className="h-8 w-8 text-purple-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">Selamat datang di AI Business Advisor!</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Tanyakan apa saja tentang strategi bisnis, pengelolaan keuangan, dan tips meningkatkan penjualan.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-lg">
                                    {suggestedQuestions.map((q, i) => (
                                        <Button key={i} variant="outline" size="sm" className="text-left justify-start h-auto py-2 text-xs" onClick={() => handleSend(q)}>
                                            {q}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        {msg.role === 'assistant' && (
                                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                                <BrainCircuit className="h-4 w-4 text-purple-500" />
                                            </div>
                                        )}
                                        <div className={`rounded-2xl px-5 py-3 max-w-[80%] border shadow-lg transition-all ${msg.role === 'user'
                                                ? 'bg-primary/20 border-primary/30 text-white rounded-tr-none'
                                                : 'bg-white/5 border-white/10 text-slate-200 rounded-tl-none'
                                            }`}>
                                            <p className="text-sm leading-relaxed tracking-tight whitespace-pre-wrap">{msg.content}</p>
                                        </div>
                                        {msg.role === 'user' && (
                                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                                                <User className="h-4 w-4 text-primary-foreground" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex gap-3 justify-start">
                                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                            <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
                                        </div>
                                        <div className="bg-muted rounded-lg px-4 py-2">
                                            <p className="text-sm text-muted-foreground">Sedang berpikir...</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
                <CardFooter>
                    <div className="flex w-full gap-3 p-2 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                        <Textarea
                            placeholder="Initialize neural query..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                            }}
                            className="min-h-[50px] max-h-[120px] bg-transparent border-none text-white focus-visible:ring-0 placeholder:text-slate-600 font-medium tracking-tight"
                            rows={1}
                        />
                        <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()} size="icon" className="shrink-0 size-12 rounded-xl bg-electric-indigo hover:bg-electric-indigo/80 text-white shadow-lg shadow-electric-indigo/20 transition-all hover:scale-105 active:scale-95">
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};

export default AIAdvisor;
