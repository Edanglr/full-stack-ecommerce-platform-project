import { render, screen, waitFor } from "@testing-library/react";
import ProductGrid from "../src/components/ProductGrid";
import { BrowserRouter } from "react-router-dom";

beforeEach(() => {
  jest.clearAllMocks();
});

test("ProductGrid renders and displays products", async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            _id: "1",
            name: "Product 1",
            price: 100,
            imageUrl: "image1.jpg",
            sizes: { S: 5, M: 3 },
          },
          {
            _id: "2",
            name: "Product 2",
            price: 150,
            imageUrl: "image2.jpg",
            sizes: { M: 2, L: 0 },
          },
        ]),
    })
  );

  render(
    <BrowserRouter>
      <ProductGrid searchTerm="" />
    </BrowserRouter>
  );

  // Ürünler ekrana geliyor mu?
  expect(await screen.findByText("Product 1")).toBeInTheDocument();
  expect(screen.getByText("Product 2")).toBeInTheDocument();

  // Fiyatlar doğru mu?
  expect(screen.getByText("100 TL")).toBeInTheDocument();
  expect(screen.getByText("150 TL")).toBeInTheDocument();
});

test("ProductGrid displays 'No products found' when list is empty", async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    })
  );

  render(
    <BrowserRouter>
      <ProductGrid searchTerm="nonexistent" />
    </BrowserRouter>
  );

  expect(
    await screen.findByText(/No products found/i)
  ).toBeInTheDocument();
});

test("ProductGrid shows error message when fetching products fails", async () => {
  global.fetch = jest.fn(() =>
    Promise.reject(new Error("Failed to fetch products"))
  );

  render(
    <BrowserRouter>
      <ProductGrid searchTerm="" />
    </BrowserRouter>
  );

  expect(
    await screen.findByText(/error/i)
  ).toBeInTheDocument();
});
