
import { render, screen } from "@testing-library/react";
import ProductDetail from "../components/ProductDetail";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CartProvider } from "../context/CartContext";

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
    })
  );
});

test("ProductDetail shows loading text when product is null", async () => {
  render(
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/product/:id" element={<ProductDetail />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );

  expect(
    await screen.findByText(/Loading product/i)
  ).toBeInTheDocument();
});
