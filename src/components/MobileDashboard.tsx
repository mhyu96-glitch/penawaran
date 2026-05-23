import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Receipt, DollarSign, Clock, Edit, LayoutDashboard, Users, Menu } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { Link } from 'react-router-dom';

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">Q</span>
          </div>
          <span className="font-semibold text-lg">QuoteApp</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs">!</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-gray-500 text-sm">Selamat datang kembali 👋</p>
          </div>
          <div className="text-right">
            <div className="bg-white rounded-lg px-3 py-1 border text-sm">
              📅 {format(new Date(), 'dd MMM - dd MMM', { locale: localeId })}
            </div>
          </div>
        </div>

        {/* Main Stats Card */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 rounded-2xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-blue-100 text-sm font-medium mb-2">
              <span>✨ HARI INI</span>
            </div>
            <h2 className="text-2xl font-bold mb-1">{getGreeting()}</h2>
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

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-sm">Faktur</h3>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Receipt className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-sm">Penawaran</h3>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <DollarSign className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-sm">Beban</h3>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-sm">Klien</h3>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex items-center justify-around">
          <Link to="/dashboard" className="flex flex-col items-center py-2 px-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mb-1">
              <LayoutDashboard className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-medium text-blue-500">Dashboard</span>
          </Link>
          
          <Link to="/quotes" className="flex flex-col items-center py-2 px-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mb-1">
              <FileText className="h-4 w-4 text-gray-500" />
            </div>
            <span className="text-xs text-gray-500">Penawaran</span>
          </Link>
          
          <Link to="/invoices" className="flex flex-col items-center py-2 px-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mb-1">
              <Receipt className="h-4 w-4 text-gray-500" />
            </div>
            <span className="text-xs text-gray-500">Faktur</span>
          </Link>
          
          <Link to="/clients" className="flex flex-col items-center py-2 px-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mb-1">
              <Users className="h-4 w-4 text-gray-500" />
            </div>
            <span className="text-xs text-gray-500">Klien</span>
          </Link>
          
          <button className="flex flex-col items-center py-2 px-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mb-1">
              <Menu className="h-4 w-4 text-gray-500" />
            </div>
            <span className="text-xs text-gray-500">Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileDashboard;