import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ShoppingBag, ArrowRight, Trash2 } from "lucide-react";

export default function Cart() {
  const cartItems = [
    {
      id: "1",
      name: "Retro Sunset T-Shirt",
      price: 24.99,
      quantity: 2,
      image:
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200&h=200&fit=crop",
      color: "Black",
      size: "M",
    },
    {
      id: "5",
      name: "Urban Street Art Hoodie",
      price: 54.99,
      quantity: 1,
      image:
        "https://images.unsplash.com/photo-1493514789131-586cb221d500?w=200&h=200&fit=crop",
      color: "Navy",
      size: "L",
    },
  ];

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const shipping = subtotal > 50 ? 0 : 9.99;
  const tax = subtotal * 0.1;
  const total = subtotal + shipping + tax;

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)} />

      {/* Header */}
      <section className="border-b border-border py-12">
        <div className="container">
          <h1 className="text-4xl font-bold mb-2">Shopping Cart</h1>
          <p className="text-foreground/60">
            You have {cartItems.length} item{cartItems.length !== 1 ? "s" : ""} in
            your cart
          </p>
        </div>
      </section>

      {cartItems.length > 0 ? (
        <section className="container py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 p-6 bg-secondary/30 rounded-lg border border-border"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-32 h-32 object-cover rounded-lg"
                    />

                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">
                        {item.name}
                      </h3>
                      <div className="space-y-1 text-sm text-foreground/60 mb-4">
                        <p>Color: {item.color}</p>
                        <p>Size: {item.size}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button className="px-2 py-1 border border-border rounded hover:bg-secondary/20 transition">
                            −
                          </button>
                          <span className="w-8 text-center font-semibold">
                            {item.quantity}
                          </span>
                          <button className="px-2 py-1 border border-border rounded hover:bg-secondary/20 transition">
                            +
                          </button>
                        </div>

                        <p className="font-bold text-lg text-primary">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>

                        <button className="p-2 text-destructive hover:bg-destructive/10 rounded transition">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                to="/shop"
                className="inline-flex items-center gap-2 text-primary font-semibold mt-8 hover:gap-3 transition-all"
              >
                Continue Shopping
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            {/* Order Summary */}
            <div className="h-fit sticky top-20">
              <div className="bg-secondary/30 rounded-lg border border-border p-6 space-y-4">
                <h2 className="text-xl font-bold">Order Summary</h2>

                <div className="space-y-3 py-4 border-y border-border">
                  <div className="flex justify-between text-foreground/70">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-foreground/70">
                    <span>Shipping</span>
                    <span>
                      {shipping === 0 ? (
                        <span className="text-primary font-semibold">Free</span>
                      ) : (
                        `$${shipping.toFixed(2)}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-foreground/70">
                    <span>Tax</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>

                {shipping === 0 && (
                  <p className="text-sm text-primary bg-primary/10 p-3 rounded">
                    ✓ You qualify for free shipping!
                  </p>
                )}

                <button className="w-full bg-primary text-white py-4 rounded-lg font-semibold hover:bg-primary/90 transition">
                  Proceed to Checkout
                </button>

                <button className="w-full border-2 border-border py-4 rounded-lg font-semibold hover:bg-secondary/20 transition">
                  Continue Shopping
                </button>

                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold mb-2">
                    Apply Promo Code
                  </summary>
                  <input
                    type="text"
                    placeholder="Enter code"
                    className="w-full px-3 py-2 border border-border rounded mb-2 focus:outline-none focus:border-primary"
                  />
                  <button className="w-full border border-border py-2 rounded hover:bg-secondary/20 transition">
                    Apply
                  </button>
                </details>
              </div>

              <p className="text-xs text-foreground/60 text-center mt-4">
                All prices are in USD and include applicable taxes
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="container py-24 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 bg-secondary/20 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-12 h-12 text-foreground/40" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-foreground/60 mb-8">
            Looks like you haven't added any items yet
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-lg font-semibold hover:bg-primary/90 transition"
          >
            Continue Shopping
            <ArrowRight className="w-5 h-5" />
          </Link>
        </section>
      )}

      <Footer />
    </div>
  );
}
