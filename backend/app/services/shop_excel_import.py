"""Parse .xlsx bulk import files for Shop rows (admin / ad manager)."""
from __future__ import annotations

from io import BytesIO
from typing import Any

from openpyxl import Workbook, load_workbook

# (canonical_field, header labels — matched case-insensitively after strip)
_HEADER_GROUPS: list[tuple[str, tuple[str, ...]]] = [
    ("name", ("name", "名称", "工厂名", "店名", "店铺名称")),
    ("address", ("address", "地址")),
    ("phone", ("phone", "电话", "手机", "联系电话")),
    ("lat", ("lat", "latitude", "纬度")),
    ("lng", ("lng", "lon", "longitude", "经度")),
    ("badge_text", ("badge_text", "tags", "标签", "徽章")),
    (
        "new_girls_last_15_days",
        ("new_girls_last_15_days", "new_badge", "新店", "显示新店"),
    ),
    ("about_me", ("about_me", "简介", "about")),
    ("additional_price", ("additional_price", "附加费用", "加价说明")),
    ("filter_city", ("filter_city", "区域", "筛选城市")),
    ("min_spend", ("min_spend", "moq", "起订量", "最低消费")),
    ("main_product", ("main_product", "主营产品", "产品", "品类")),
]

REQUIRED_FIELDS = ("name", "address", "phone", "lat", "lng")

_HEADER_TO_FIELD: dict[str, str] = {}
for field, labels in _HEADER_GROUPS:
    for label in labels:
        key = label.strip().lower()
        if key and key not in _HEADER_TO_FIELD:
            _HEADER_TO_FIELD[key] = field

MAX_IMPORT_ROWS = 500


def _norm_header(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\ufeff", "").strip().lower()


def _cell_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value == int(value):
            return str(int(value))
        return str(value).strip()
    s = str(value).strip()
    return s if s else None


def _parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).strip().replace(",", "."))
    except (TypeError, ValueError):
        return None


def _parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    if isinstance(value, float):
        return value != 0.0
    s = (str(value).strip().lower() if value is not None else "")
    return s in ("1", "true", "yes", "y", "是", "对")


def _row_to_payload(header_to_col: dict[str, int], row: tuple[Any, ...]) -> dict[str, Any]:
    def get(field: str) -> Any:
        idx = header_to_col.get(field)
        if idx is None or idx >= len(row):
            return None
        return row[idx]

    name = _cell_str(get("name"))
    address = _cell_str(get("address"))
    phone = _cell_str(get("phone"))
    lat = _parse_float(get("lat"))
    lng = _parse_float(get("lng"))
    badge = _cell_str(get("badge_text"))
    about = _cell_str(get("about_me")) or ""
    add_price = _cell_str(get("additional_price")) or ""
    filter_city = _cell_str(get("filter_city")) or ""
    min_raw = get("min_spend")
    min_str = _cell_str(min_raw) if min_raw is not None else None
    main_product = _cell_str(get("main_product")) or ""

    raw_new = get("new_girls_last_15_days")
    new_girls = _parse_bool(raw_new) if raw_new not in (None, "") else False

    data: dict[str, Any] = {}
    if name is not None:
        data["name"] = name
    if address is not None:
        data["address"] = address
    if phone is not None:
        data["phone"] = phone
    if lat is not None:
        data["lat"] = lat
    if lng is not None:
        data["lng"] = lng
    if badge is not None:
        data["badge_text"] = badge
    data["new_girls_last_15_days"] = new_girls
    data["about_me"] = about
    data["additional_price"] = add_price
    if filter_city:
        data["filter_city"] = filter_city
    if min_str:
        data["min_spend"] = min_str
    if main_product:
        data["main_product"] = main_product
    return data


def parse_shop_import_excel(raw_bytes: bytes) -> tuple[list[tuple[int, dict[str, Any]]], str | None]:
    """
    Returns (list of (excel_row_number, payload_dict)), error_message_or_none.
    Rows with empty name are skipped. Stops after MAX_IMPORT_ROWS data rows.
    """
    try:
        wb = load_workbook(BytesIO(raw_bytes), read_only=True, data_only=True)
    except Exception as e:
        return [], f"Invalid Excel file: {e}"

    try:
        ws = wb.active
        it = ws.iter_rows(values_only=True)
        header_row = next(it, None)
        if not header_row:
            return [], "Empty spreadsheet"

        header_to_col: dict[str, int] = {}
        for idx, cell in enumerate(header_row):
            h = _norm_header(cell)
            if not h:
                continue
            field = _HEADER_TO_FIELD.get(h)
            if field and field not in header_to_col:
                header_to_col[field] = idx

        missing = [f for f in REQUIRED_FIELDS if f not in header_to_col]
        if missing:
            return [], "Missing required columns: " + ", ".join(missing)

        out: list[tuple[int, dict[str, Any]]] = []
        for row_idx, row in enumerate(it, start=2):
            if len(out) >= MAX_IMPORT_ROWS:
                break
            if not row:
                continue
            payload = _row_to_payload(header_to_col, row)
            name = (payload.get("name") or "").strip()
            if not name:
                continue
            out.append((row_idx, payload))
        return out, None
    finally:
        wb.close()


def build_template_workbook_bytes() -> bytes:
    """Single sheet with header row only (English headers)."""
    wb = Workbook()
    ws = wb.active
    if ws is None:
        ws = wb.create_sheet("shops")
    else:
        ws.title = "shops"
    headers = [
        "name",
        "address",
        "phone",
        "lat",
        "lng",
        "badge_text",
        "new_girls_last_15_days",
        "about_me",
        "additional_price",
        "filter_city",
        "min_spend",
        "main_product",
    ]
    ws.append(headers)
    bio = BytesIO()
    wb.save(bio)
    return bio.getvalue()
