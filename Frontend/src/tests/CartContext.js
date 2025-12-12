
import { renderHook, act } from "@testing-library/react";
import { CartProvider, useCart } from "../src/context/CartContext";

test("addToCart adds new item to cart", () => {
  const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;
  const { result } = renderHook(() => useCart(), { wrapper });

  act(() => {
    result.current.addToCart(
      { _id: "p1", name: "Shirt", price: 100, imageUrl: "" },
      2,
      "M"
    );
  });

  expect(result.current.cart.length).toBe(1);
  expect(result.current.cart[0].quantity).toBe(2);
});
