import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders navbar brand", () => {
  render(<App />);
  expect(screen.getByText(/La Strada/i)).toBeInTheDocument();
});

test("renders All Products heading", () => {
  render(<App />);
  expect(screen.getByText(/All Products/i)).toBeInTheDocument();
});
