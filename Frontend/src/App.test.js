import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { CartProvider } from "./context/CartContext";

// App içindeki ağır / fetch yapan componentleri mockla
jest.mock("./components/ProductGrid", () => () => <div>MOCK ProductGrid</div>);
jest.mock("./components/HeroVideo", () => () => <div>MOCK HeroVideo</div>);
jest.mock("./components/CustomerChat", () => () => <div>MOCK CustomerChat</div>);

test("renders navbar brand", () => {
  render(
    <CartProvider>
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    </CartProvider>
  );

  // Brand artık La Strada
  expect(screen.getByText(/La Strada/i)).toBeInTheDocument();
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
