from sqlalchemy import text

from backend.app.core.database import engine


def main() -> None:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1")).scalar_one()

    if result != 1:
        raise RuntimeError(f"Unexpected SELECT 1 result: {result}")

    print("database connection established")
    print(f"SELECT 1 -> {result}")


if __name__ == "__main__":
    main()
