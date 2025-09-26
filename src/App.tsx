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
import QuoteList from "./pages/QuoteList";
import QuoteView from "./pages/QuoteView";
import Profile from "./pages/Profile";
import SharedLayout from "./components/SharedLayout";
import ClientList from "./pages/ClientList";
import Dashboard from "./pages/Dashboard";
import ItemList from "./pages/ItemList";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            
            <Route element={<ProtectedRoute />}>
              <Route element={<SharedLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/quotes" element={<QuoteList />} />
                <Route path="/quote/new" element={<QuoteGenerator />} />
                <Route path="/quote/edit/:id" element={<QuoteGenerator />} />
                <Route path="/quote/:id" element={<QuoteView />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/clients" element={<ClientList />} />
                <Route path="/items" element={<ItemList />} />
              </Route>
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;