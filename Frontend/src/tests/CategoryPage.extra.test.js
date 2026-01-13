import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import CategoryPage from "../components/CategoryPage";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useParams: () => ({ categoryName: "t-shirt" }),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn();
});

describe("CategoryPage", () => {
  test("loads products and shows them", async () => {
    // products fetch
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { _id: "p1", name: "Tee", price: 100, imageUrl: "x", sizes: { S: 1 } },
        ],
      })
      // ratings fetch for p1
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ averageRating: 4.5, ratingCount: 10 }),
      });

    render(<CategoryPage />);

    expect(await screen.findByText("Tee")).toBeInTheDocument();
    expect(await screen.findByText(/4\.5/i)).toBeInTheDocument();
  });

  test("sort buttons change sort state (smoke)", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { _id: "p1", name: "A", price: 200, imageUrl: "x", sizes: { S: 1 } },
          { _id: "p2", name: "B", price: 100, imageUrl: "x", sizes: { S: 1 } },
        ],
      })
      // ratings for p1, p2
      .mockResolvedValueOnce({ ok: true, json: async () => ({ averageRating: 0, ratingCount: 0 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ averageRating: 0, ratingCount: 0 }) });

    render(<CategoryPage />);
    expect(await screen.findByText("A")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Price ↑/i));
    // sadece crash etmediğini doğrulamak yeter
    expect(screen.getByText(/Price ↑/i)).toBeInTheDocument();
  });
});
