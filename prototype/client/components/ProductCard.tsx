import { Link } from "react-router-dom";
import { ShoppingCart, Heart, Star } from "lucide-react";
import { Product } from "@shared/api";
import { useState } from "react";

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link to={`/product/${product.id}`}>
      <div className="group cursor-pointer">
        <div
          className="relative overflow-hidden rounded-lg bg-secondary/20 aspect-square mb-4 transition-all duration-300"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />

          {isHovered && (
            <div className="absolute inset-0 bg-black/20 flex items-end justify-between p-3 animate-in fade-in duration-200">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onAddToCart?.(product);
                }}
                className="flex-1 bg-primary text-white rounded-lg py-2 px-3 font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden sm:inline">Add</span>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsFavorite(!isFavorite);
                }}
                className="ml-2 p-2 bg-white rounded-lg hover:bg-secondary/20 transition-colors"
              >
                <Heart
                  className={`w-5 h-5 ${
                    isFavorite ? "fill-primary text-primary" : ""
                  }`}
                />
              </button>
            </div>
          )}

          <div className="absolute top-3 left-3">
            <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
              New
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-foreground/60 font-medium uppercase tracking-wide">
            {product.category}
          </p>
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {product.name}
          </h3>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < Math.floor(product.rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-foreground/20"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-foreground/60">
              ({product.reviews})
            </span>
          </div>

          <div className="pt-2">
            <p className="text-lg font-bold text-primary">
              ${product.price.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
