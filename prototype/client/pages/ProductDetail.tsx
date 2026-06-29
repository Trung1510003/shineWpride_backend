import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { mockProducts } from "@/lib/mockProducts";
import {
  ShoppingCart,
  Heart,
  Star,
  Share2,
  Truck,
  Shield,
  RotateCcw,
  ChevronRight,
} from "lucide-react";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const product = mockProducts.find((p) => p.id === id);
  const [cartCount, setCartCount] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product?.colors?.[0] || "");
  const [selectedSize, setSelectedSize] = useState(product?.sizes?.[0] || "");
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header cartCount={cartCount} />
        <div className="container py-12 text-center">
          <p className="text-foreground/60 mb-4">Product not found</p>
          <Link to="/shop" className="text-primary font-semibold hover:underline">
            Back to shop
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const relatedProducts = mockProducts.filter(
    (p) => p.category === product.category && p.id !== product.id
  );

  const handleAddToCart = () => {
    setCartCount(cartCount + quantity);
    setQuantity(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cartCount} />

      {/* Breadcrumb */}
      <div className="border-b border-border">
        <div className="container py-4 flex items-center gap-2 text-sm text-foreground/60">
          <Link to="/" className="hover:text-foreground transition">
            Home
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link to="/shop" className="hover:text-foreground transition">
            Shop
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">{product.name}</span>
        </div>
      </div>

      {/* Product Section */}
      <section className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Image */}
          <div className="flex items-center justify-center bg-secondary/20 rounded-lg aspect-square overflow-hidden">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>

          {/* Details */}
          <div>
            <div className="mb-6">
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                {product.category}
              </p>
              <h1 className="text-4xl font-bold mb-4">{product.name}</h1>

              {/* Rating */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i < Math.floor(product.rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-foreground/20"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-foreground/60">
                  {product.rating} ({product.reviews} reviews)
                </span>
              </div>

              <p className="text-3xl font-bold text-primary mb-2">
                ${product.price.toFixed(2)}
              </p>
            </div>

            {/* Description */}
            <p className="text-foreground/70 mb-8 leading-relaxed">
              {product.description}
            </p>

            {/* Color Selection */}
            {product.colors && product.colors.length > 0 && (
              <div className="mb-8">
                <label className="text-sm font-semibold block mb-3">
                  Color: <span className="text-primary">{selectedColor}</span>
                </label>
                <div className="flex gap-3">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        selectedColor === color
                          ? "bg-primary text-white border-2 border-primary"
                          : "border-2 border-border hover:border-primary/50"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mb-8">
                <label className="text-sm font-semibold block mb-3">
                  Size: <span className="text-primary">{selectedSize}</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`py-3 rounded-lg font-medium transition-all border ${
                        selectedSize === size
                          ? "bg-primary text-white border-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-8">
              <label className="text-sm font-semibold block mb-3">
                Quantity
              </label>
              <div className="flex items-center gap-2 w-fit">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 border border-border rounded hover:bg-secondary/20 transition"
                >
                  −
                </button>
                <span className="px-6 py-2 font-semibold">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-2 border border-border rounded hover:bg-secondary/20 transition"
                >
                  +
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mb-8">
              <button
                onClick={handleAddToCart}
                className="flex-1 bg-primary text-white py-4 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition"
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
              </button>
              <button
                onClick={() => setIsFavorite(!isFavorite)}
                className={`px-6 py-4 rounded-lg border-2 transition ${
                  isFavorite
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary"
                }`}
              >
                <Heart
                  className={`w-5 h-5 ${
                    isFavorite ? "fill-primary text-primary" : ""
                  }`}
                />
              </button>
              <button className="px-6 py-4 rounded-lg border-2 border-border hover:border-primary transition">
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            {/* Features */}
            <div className="space-y-3 pt-8 border-t border-border">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-primary" />
                <span className="text-sm text-foreground/70">
                  Free shipping on orders over $50
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-sm text-foreground/70">
                  100% safe & secure checkout
                </span>
              </div>
              <div className="flex items-center gap-3">
                <RotateCcw className="w-5 h-5 text-primary" />
                <span className="text-sm text-foreground/70">
                  30-day money back guarantee
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="py-12 border-t border-border bg-secondary/30">
          <div className="container">
            <h2 className="text-3xl font-bold mb-8">Similar Products</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.slice(0, 4).map((p) => (
                <Link key={p.id} to={`/product/${p.id}`} className="group">
                  <div className="bg-secondary/20 rounded-lg aspect-square mb-3 overflow-hidden">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                    />
                  </div>
                  <p className="text-xs text-primary font-bold uppercase mb-1">
                    {p.category}
                  </p>
                  <h3 className="font-semibold group-hover:text-primary transition line-clamp-2">
                    {p.name}
                  </h3>
                  <p className="text-primary font-bold mt-2">
                    ${p.price.toFixed(2)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
