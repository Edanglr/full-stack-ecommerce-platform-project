import { render, screen } from "@testing-library/react";
import ProductGrid from "../components/ProductGrid";
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
          { _id: "1", name: "Product 1", price: 100, imageUrl: "image1.jpg", sizes: { S: 5, M: 3 } },
          { _id: "2", name: "Product 2", price: 150, imageUrl: "image2.jpg", sizes: { M: 2, L: 0 } },
        ]),
    })
  );

  render(
    <BrowserRouter>
      <ProductGrid searchTerm="" />
    </BrowserRouter>
  );

  expect(await screen.findByText("Product 1")).toBeInTheDocument();
  expect(screen.getByText("Product 2")).toBeInTheDocument();

  expect(screen.getByText("100 TL")).toBeInTheDocument();
  expect(screen.getByText("150 TL")).toBeInTheDocument();
});

test("ProductGrid shows empty grid when list is empty", async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    })
  );

  const { container } = render(
    <BrowserRouter>
      <ProductGrid searchTerm="nonexistent" />
    </BrowserRouter>
  );

  // Heading yine var
  expect(await screen.findByText(/All Products/i)).toBeInTheDocument();

  // ✅ boşken row var ama içinde card yok
  const row = container.querySelector(".row");
  expect(row).toBeTruthy();
  expect(row.children.length).toBe(0);
});

test("ProductGrid shows error message when fetching products fails", async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error("Failed to fetch products")));

  render(
    <BrowserRouter>
      <ProductGrid searchTerm="" />
    </BrowserRouter>
  );

  // Component error state err.message basıyorsa bu geçer
  expect(await screen.findByText(/Failed to fetch products/i)).toBeInTheDocument();
});
