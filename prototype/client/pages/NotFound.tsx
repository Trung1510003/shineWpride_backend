import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="container py-24 text-center">
        <div className="mb-6">
          <h1 className="text-9xl font-bold text-primary/30 mb-4">404</h1>
          <h2 className="text-4xl font-bold mb-4">Page Not Found</h2>
        </div>

        <p className="text-foreground/60 mb-8 max-w-md mx-auto">
          Sorry, the page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-lg font-semibold hover:bg-primary/90 transition"
          >
            Go Home
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            to="/shop"
            className="inline-flex items-center justify-center gap-2 border-2 border-border px-8 py-4 rounded-lg font-semibold hover:bg-secondary/20 transition"
          >
            Continue Shopping
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
