import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  // localStorage'dan yükle
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cart");
      if (saved) {
        setCart(JSON.parse(saved));
      }
    } catch (err) {
      console.error("Cart load error:", err);
      localStorage.removeItem("cart");
    }
  }, []);

  // cart değişince kaydet
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  // ürün ekle (ürün + beden)
  const addToCart = (product, quantity, size) => {
    const existingIndex = cart.findIndex(
      (item) => item.productId === product._id && item.size === size
    );

    let updatedCart;

    if (existingIndex !== -1) {
      updatedCart = [...cart];
      updatedCart[existingIndex].quantity += quantity;
    } else {
      updatedCart = [
        ...cart,
        {
          productId: product._id,
          name: product.name,
          price: product.price,
          size,
          quantity,
          image: product.imageUrl,
        },
      ];
    }

    setCart(updatedCart);
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, setCart, addToCart, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
