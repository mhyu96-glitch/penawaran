import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Receipt, DollarSign, Clock, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

const MobileDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    quotesCount: 0,
    invoicesCount: 0,
    totalPayments: 0,
    overdueInvoices: 0,
    monthlyTarget: 0,
    monthlyProgress: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        const [quotesRes, invoicesRes, paymentsRes, overdueRes] = await Promise.all([
          supabase.from('quotes').select('id').eq('user_id', user.id),
          supabase.from('invoices').select('id').eq('user_id', user.id),
          supabase.from('payments').select('amount').eq('user_id', user.id).eq('status', 'Lunas'),
          supabase.from('invoices').select('id').eq('user_id', user.id).neq('status', 'Lunas').lt('due_date', new Date().toISOString())
        ]);

        const totalPayments = paymentsRes.data?.reduce((sum, payment) => sum + payment.amount, 0) || 0;

        setStats({
          quotesCount: quotesRes.data?.length || 0,
          invoicesCount: invoicesRes.data?.length || 0,
          totalPayments,
          overdueInvoices: overdueRes.data?.length || 0,
          monthlyTarget: 0, // This would come from user settings
          monthlyProgress: totalPayments
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi! ☀️';
    if (hour < 17) return 'Selamat Siang! 🌤️';
    if (hour < 20) return 'Selamat Sore! 🌅';
    return 'Selamat Malam! 🌙';
  };

  const getCurrentDate = () => {
    return format(new Date(), 'EEEE, dd MMMM yyyy', { locale: localeId });
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-blue-500 rounded-2xl p-6 text-white animate-pulse">
          <div className="h-6 bg-blue-400 rounded mb-2"></div>
          <div className="h-8 bg-blue-400 rounded mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-16 bg-blue-400 rounded"></div>
            <div className="h-16 bg-blue-400 rounded"></div>
            <div className="h-16 bg-blue-400 rounded"></div>
            <div className="h-16 bg-blue-400 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      {/* Welcome Card */}
      <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-blue-100 text-sm font-medium mb-2">
            <span>✨ HARI INI</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">{getGreeting()}</h1>
          <p className="text-blue-100 text-sm mb-6">{getCurrentDate()}</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-blue-100" />
              </div>
              <div className="text-2xl font-bold">{stats.quotesCount}</div>
              <div className="text-xs text-blue-100">dokumen</div>
              <div className="text-xs text-blue-100">Penawaran Dibuat</div>
            </div>
            
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-5 w-5 text-blue-100" />
              </div>
              <div className="text-2xl font-bold">{stats.invoicesCount}</div>
              <div className="text-xs text-blue-100">dokumen</div>
              <div className="text-xs text-blue-100">Faktur Dibuat</div>
            </div>
            
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-blue-100" />
              </div>
              <div className="text-lg font-bold">{formatCurrency(stats.totalPayments)}</div>
              <div className="text-xs text-blue-100">Pembayaran Masuk</div>
            </div>
            
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-red-300" />
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              </div>
              <div className="text-2xl font-bold">{stats.overdueInvoices}</div>
              <div className="text-xs text-blue-100">faktur</div>
              <div className="text-xs text-blue-100">Faktur Jatuh Tempo</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Target Card */}
      <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-lg">🎯</span>
              </div>
              <span className="font-semibold">Target Bulan Ini</span>
            </div>
            <Edit className="h-5 w-5 text-blue-200" />
          </div>
          
          <div className="text-3xl font-bold mb-2">
            {formatCurrency(stats.monthlyProgress)} <span className="text-lg font-normal text-blue-200">/ {formatCurrency(stats.monthlyTarget)}</span>
          </div>
          
          <div className="w-full bg-white/20 rounded-full h-2 mb-2">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-300" 
              style={{ 
                width: stats.monthlyTarget > 0 ? `${Math.min((stats.monthlyProgress / stats.monthlyTarget) * 100, 100)}%` : '0%' 
              }}
            ></div>
          </div>
          
          <div className="text-xs text-blue-100">
            {stats.monthlyTarget > 0 
              ? `${((stats.monthlyProgress / stats.monthlyTarget) * 100).toFixed(1)}% tercapai`
              : 'Belum ada target yang ditetapkan'
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileDashboard;