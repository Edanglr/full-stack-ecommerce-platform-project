import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import FavoritesPage from "../components/FavoritePage";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

jest.mock("../components/ProfileLayout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="profile-layout">{children}</div>,
}));

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn();
  localStorage.clear();
});

function mockFetchJson(ok, json) {
  global.fetch.mockResolvedValueOnce({
    ok,
    json: async () => json,
  });
}

describe("FavoritesPage", () => {
  test("redirects to login when token missing", async () => {
    render(<FavoritesPage />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/login"));
  });

  test("renders empty favorites state", async () => {
    localStorage.setItem("token", "tkn");
    mockFetchJson(true, []);

    render(<FavoritesPage />);

    expect(await screen.findByText(/My Favorites/i)).toBeInTheDocument();
    expect(await screen.findByText(/You have no favorite items yet/i)).toBeInTheDocument();
  });

  test("remove favorite triggers toggle and reload", async () => {
    localStorage.setItem("token", "tkn");

    // initial load
    mockFetchJson(true, [
      {
        _id: "fav1",
        product: {
          _id: "p1",
          name: "Hoodie",
          imageUrl: "x",
          price: 100,
          discountRate: 0,
        },
      },
    ]);

    // toggle
    mockFetchJson(true, { message: "Removed", favorite: false });

    // reload after toggle
    mockFetchJson(true, []);

    render(<FavoritesPage />);

    expect(await screen.findByText("Hoodie")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Remove/i));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5050/api/favorites/toggle",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
