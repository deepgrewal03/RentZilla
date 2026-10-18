import assert from "node:assert/strict";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { activeCatalog, isRetiredCategory } from "./retiredCategories";

test("all five retired types are blocked, including legacy spelling separators", () => {
  for (const value of ["Sprayer", "Rock Breaker", "Bulldozer", "Painter", "Wheel Loader",
    "rock_breaker", "WHEEL-LOADER", " sprayer ", "BULLDOZER"]) {
    assert.equal(isRetiredCategory(value), true, value);
  }
  for (const value of [null, undefined, "", "Tractor", "Loader", "Backhoe", "Carpenter", "Plumbing"]) {
    assert.equal(isRetiredCategory(value), false, String(value));
  }
});

test("catalog SQL excludes retired types without excluding uncategorized legacy records", () => {
  const query = new PgDialect().sqlToQuery(activeCatalog);
  assert.match(query.sql, /coalesce/);
  for (const value of ["sprayer", "rockbreaker", "bulldozer", "painter", "wheelloader"]) {
    assert.ok(query.sql.includes(`'${value}'`));
  }
  assert.match(query.sql, /NOT IN/);
});
