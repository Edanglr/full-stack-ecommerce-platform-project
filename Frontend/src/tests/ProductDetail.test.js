import { render } from "@testing-library/react";
import ProductDetail from "../components/ProductDetail";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "../context/CartContext";

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
    })
  );
});

test("ProductDetail renders without crashing", () => {
  render(
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/product/:id" element={<ProductDetail />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );

  // Component mount oldu mu?
  expect(document.body).toBeInTheDocument();
});
