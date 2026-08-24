import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import QuoteGenerator from "./pages/QuoteGenerator";
import { AuthProvider } from "./contexts/SessionContext";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import QuoteListSimple from "./pages/QuoteListSimple";
import QuoteView from "./pages/QuoteView";
import Profile from "./pages/Profile";
import SharedLayout from "./components/SharedLayout";
import ClientList from "./pages/ClientList";
import Dashboard from "./pages/Dashboard";
import ItemList from "./pages/ItemList";
import Settings from "./pages/Settings";
import ClientDetail from "./pages/ClientDetail";
import InvoiceList from "./pages/InvoiceList";
import InvoiceGenerator from "./pages/InvoiceGenerator";
import InvoiceView from "./pages/InvoiceView";
import ExpenseList from "./pages/ExpenseList";
import Reports from "./pages/Reports";
import ProfitabilityReports from "./pages/ProfitabilityReports";
import PublicQuoteView from "./pages/PublicQuoteView";
import PublicInvoiceView from "./pages/PublicInvoiceView";
import ClientPortal from "./pages/ClientPortal";
import { ThemeProvider } from "./components/ThemeProvider";
import ExpenseReport from "./pages/ExpenseReport";
import ProjectList from "./pages/ProjectList";
import ProjectDetail from "./pages/ProjectDetail";
import ProfitLossReport from "./pages/ProfitLossReport";
import Automation from "./pages/Automation";
import ProjectCalendar from "./pages/ProjectCalendar";
import RecurringInvoiceList from "./pages/RecurringInvoiceList";

// Glass Morphism Pages
import DashboardGlass from "./pages/DashboardGlass";
import QuoteListGlass from "./pages/QuoteListGlass";
import InvoiceListGlass from "./pages/InvoiceListGlass";
import GlassThemeHub from "./pages/GlassThemeHub";
import QuoteFormGlass from "./pages/QuoteFormGlass";
import InvoiceFormGlass from "./pages/InvoiceFormGlass";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/quote/public/:id" element={<PublicQuoteView />} />
              <Route path="/invoice/public/:id" element={<PublicInvoiceView />} />
              <Route path="/portal/:accessKey" element={<ClientPortal />} />
              
              <Route element={<ProtectedRoute />}>
                <Route element={<SharedLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/quotes" element={<QuoteListSimple />} />
                  <Route path="/quote/new" element={<QuoteGenerator />} />
                  <Route path="/quote/edit/:id" element={<QuoteGenerator />} />
                  <Route path="/quote/:id" element={<QuoteView />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/clients" element={<ClientList />} />
                  <Route path="/client/:id" element={<ClientDetail />} />
                  <Route path="/items" element={<ItemList />} />
                  <Route path="/invoices" element={<InvoiceList />} />
                  <Route path="/invoices/recurring" element={<RecurringInvoiceList />} />
                  <Route path="/invoice/new" element={<InvoiceGenerator />} />
                  <Route path="/invoice/edit/:id" element={<InvoiceGenerator />} />
                  <Route path="/invoice/:id" element={<InvoiceView />} />
                  <Route path="/expenses" element={<ExpenseList />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/reports/profitability" element={<ProfitabilityReports />} />
                  <Route path="/reports/expenses" element={<ExpenseReport />} />
                  <Route path="/reports/profit-loss" element={<ProfitLossReport />} />
                  <Route path="/projects" element={<ProjectList />} />
                  <Route path="/project/:id" element={<ProjectDetail />} />
                  <Route path="/automation" element={<Automation />} />
                  <Route path="/calendar" element={<ProjectCalendar />} />
                  
                  {/* Glass Morphism Pages */}
                  <Route path="/glass" element={<GlassThemeHub />} />
                  <Route path="/dashboard-glass" element={<DashboardGlass />} />
                  <Route path="/quotes-glass" element={<QuoteListGlass />} />
                  <Route path="/quote-glass/new" element={<QuoteFormGlass />} />
                  <Route path="/quote-glass/edit/:id" element={<QuoteFormGlass />} />
                  <Route path="/invoices-glass" element={<InvoiceListGlass />} />
                  <Route path="/invoice-glass/new" element={<InvoiceFormGlass />} />
                  <Route path="/invoice-glass/edit/:id" element={<InvoiceFormGlass />} />
                </Route>
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;