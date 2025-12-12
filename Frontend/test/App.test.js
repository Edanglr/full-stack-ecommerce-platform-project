import { render, screen } from "@testing-library/react";
import App from "../src/App";
import { BrowserRouter } from "react-router-dom";

test("App renders and shows All Products heading", () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );

  expect(screen.getByText(/All Products/i)).toBeInTheDocument();
});
