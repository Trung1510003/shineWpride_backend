import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { mockProducts } from "@/lib/mockProducts";
import { Filter, X } from "lucide-react";

export default function Shop() {
  const [cartCount, setCartCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("featured");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const categories = [
    "All Products",
    "Apparel",
    "Art & Decor",
    "Accessories",
    "Home",
    "Stickers",
  ];

  let filteredProducts = mockProducts;

  if (selectedCategory && selectedCategory !== "All Products") {
    filteredProducts = mockProducts.filter(
      (p) => p.category === selectedCategory
    );
  }

  if (sortBy === "price-low") {
    filteredProducts = [...filteredProducts].sort((a, b) => a.price - b.price);
  } else if (sortBy === "price-high") {
    filteredProducts = [...filteredProducts].sort((a, b) => b.price - a.price);
  } else if (sortBy === "rating") {
    filteredProducts = [...filteredProducts].sort((a, b) => b.rating - a.rating);
  } else if (sortBy === "newest") {
    filteredProducts = [...filteredProducts].reverse();
  }

  const handleAddToCart = () => {
    setCartCount((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cartCount} />

      {/* Header */}
      <section className="border-b border-border py-12">
        <div className="container">
          <h1 className="text-4xl font-bold mb-2">Shop All Products</h1>
          <p className="text-foreground/60">
            Explore our complete collection of unique designs
          </p>
        </div>
      </section>

      <div className="container py-12">
        <div className="flex gap-6 lg:gap-12">
          {/* Sidebar Filters */}
          <div
            className={`fixed inset-0 z-50 bg-black/50 lg:static lg:z-auto lg:bg-transparent ${
              isFilterOpen ? "block" : "hidden lg:block"
            }`}
            onClick={() => setIsFilterOpen(false)}
          >
            <div
              className="fixed left-0 top-0 bottom-0 w-80 bg-background border-r border-border p-6 overflow-y-auto lg:static lg:w-auto lg:border-0 lg:p-0 lg:bg-transparent"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6 lg:hidden">
                <h2 className="font-bold text-lg">Filters</h2>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="p-1 hover:bg-secondary/20 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Categories */}
              <div className="mb-8">
                <h3 className="font-semibold mb-4">Category</h3>
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <label
                      key={cat}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <input
                        type="radio"
                        name="category"
                        checked={
                          selectedCategory === cat ||
                          (selectedCategory === null && cat === "All Products")
                        }
                        onChange={() =>
                          setSelectedCategory(
                            cat === "All Products" ? null : cat
                          )
                        }
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm text-foreground/70 group-hover:text-foreground transition">
                        {cat}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sort Options */}
              <div className="mb-8">
                <h3 className="font-semibold mb-4">Sort By</h3>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="featured">Featured</option>
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>

              {/* Price Range */}
              <div className="mb-8">
                <h3 className="font-semibold mb-4">Price Range</h3>
                <div className="space-y-2">
                  {["$0 - $20", "$20 - $50", "$50 - $100", "$100+"].map(
                    (range) => (
                      <label key={range} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded accent-primary"
                        />
                        <span className="text-sm text-foreground/70">
                          {range}
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* Close button for mobile */}
              <button
                onClick={() => setIsFilterOpen(false)}
                className="w-full lg:hidden mt-8 py-2 bg-primary text-white rounded-lg font-semibold"
              >
                Apply Filters
              </button>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1">
            {/* Mobile Filter Button */}
            <div className="flex justify-between items-center mb-6 lg:hidden">
              <p className="text-sm text-foreground/60">
                Showing {filteredProducts.length} products
              </p>
              <button
                onClick={() => setIsFilterOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-secondary/20 transition"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>

            {/* Desktop Sort */}
            <div className="hidden lg:flex justify-between items-center mb-6">
              <p className="text-sm text-foreground/60">
                Showing {filteredProducts.length} products
              </p>
            </div>

            {/* Products */}
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-foreground/60 mb-2">No products found</p>
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSortBy("featured");
                  }}
                  className="text-primary font-semibold hover:underline"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
