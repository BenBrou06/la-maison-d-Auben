import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Layout } from "@/components/Layout";
import Home from "@/pages/Home";
import Boutique from "@/pages/Boutique";
import ProductDetail from "@/pages/ProductDetail";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import DownloadPage from "@/pages/DownloadPage";
import Blog from "@/pages/Blog";
import Article from "@/pages/Article";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Faq from "@/pages/Faq";
import Legal from "@/pages/Legal";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";

const withLayout = (el) => <Layout>{el}</Layout>;

function App() {
  return (
    <div className="App">
      <Toaster position="top-center" richColors closeButton />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={withLayout(<Home />)} />
          <Route path="/boutique" element={withLayout(<Boutique />)} />
          <Route path="/boutique/:slug" element={withLayout(<ProductDetail />)} />
          <Route path="/paiement/succes" element={withLayout(<PaymentSuccess />)} />
          <Route path="/paiement/annule" element={withLayout(<PaymentCancel />)} />
          <Route path="/telechargement/:token" element={withLayout(<DownloadPage />)} />
          <Route path="/ressources" element={withLayout(<Blog />)} />
          <Route path="/ressources/:slug" element={withLayout(<Article />)} />
          <Route path="/a-propos" element={withLayout(<About />)} />
          <Route path="/contact" element={withLayout(<Contact />)} />
          <Route path="/faq" element={withLayout(<Faq />)} />
          <Route path="/mentions-legales" element={withLayout(<Legal pageKey="mentions-legales" />)} />
          <Route path="/cgv" element={withLayout(<Legal pageKey="cgv" />)} />
          <Route path="/confidentialite" element={withLayout(<Legal pageKey="confidentialite" />)} />
          <Route path="/politique-cookies" element={withLayout(<Legal pageKey="politique-cookies" />)} />
          <Route path="/produits-numeriques" element={withLayout(<Legal pageKey="produits-numeriques" />)} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
