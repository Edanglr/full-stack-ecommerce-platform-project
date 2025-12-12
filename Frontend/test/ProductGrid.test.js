import { render, screen, waitFor } from "@testing-library/react";
import ProductGrid from "../src/components/ProductGrid";
import { BrowserRouter } from "react-router-dom";

beforeEach(() => {
  // Mock fetch API to simulate getting products
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        { _id: "1", name: "Product 1", price: 100, imageUrl: "image1.jpg", sizes: { S: 5, M: 3 } },
        { _id: "2", name: "Product 2", price: 150, imageUrl: "image2.jpg", sizes: { M: 2, L: 0 } },
      ]),
    })
  );
});

test("ProductGrid renders and displays products", async () => {
  render(
    <BrowserRouter>
      <ProductGrid searchTerm="" />
    </BrowserRouter>
  );

  // Check if loading text appears first
  expect(await screen.findByText(/Loading products/i)).toBeInTheDocument();

  // Wait for products to load
  await waitFor(() => {
    expect(screen.getByText(/Product 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Product 2/i)).toBeInTheDocument();
  });

  // Ensure correct data is displayed
  expect(screen.getByText("100 TL")).toBeInTheDocument();
  expect(screen.getByText("150 TL")).toBeInTheDocument();
});

test("ProductGrid displays 'No products found' when no products match the search term", async () => {
  render(
    <BrowserRouter>
      <ProductGrid searchTerm="nonexistent" />
    </BrowserRouter>
  );

  // Wait for the error state (no products)
  await waitFor(() => {
    expect(screen.getByText(/No products found/i)).toBeInTheDocument();
  });
});

test("ProductGrid shows error message when fetching products fails", async () => {
  // Mock failed fetch call
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      statusText: "Network Error",
    })
  );

  render(
    <BrowserRouter>
      <ProductGrid searchTerm="" />
    </BrowserRouter>
  );

  // Wait for error message to appear
  expect(await screen.findByText(/Error loading products/i)).toBeInTheDocument();
});
