// src/App.test.js
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { CartProvider } from "./context/CartContext";

test("renders navbar brand", () => {
  render(
    <CartProvider>
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    </CartProvider>
  );

  // projede brand neyse ona göre: "UMBRELLA" / "Umbrella" vs.
  expect(screen.getByText(/UMBRELLA/i)).toBeInTheDocument();
});

test("renders All Products heading", () => {
  render(
    <CartProvider>
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    </CartProvider>
  );

  expect(screen.getByText(/All Products/i)).toBeInTheDocument();
});
