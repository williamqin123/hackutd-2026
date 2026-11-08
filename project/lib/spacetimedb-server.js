import Papa from "papaparse";
import { DbConnection } from "../src/module_bindings";

export const INTERVAL_MS = 1000;

const DB_URI = process.env.NEXT_PUBLIC_SPACETIMEDB_URI ?? "ws://localhost:3000";

const DB_NAME = process.env.NEXT_PUBLIC_SPACETIMEDB_DB ?? "flood-db";

function optionalString(value) {
  return value?.trim() || undefined;
}

function optionalBigInt(value) {
  const text = optionalString(value);
  return text === undefined ? undefined : BigInt(text);
}

function optionalNumber(value) {
  const text = optionalString(value);
  if (text === undefined) return undefined;

  const number = Number(text);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid number: ${text}`);
  }

  return number;
}

function requiredNumber(value, field) {
  const number = optionalNumber(value);

  if (number === undefined) {
    throw new Error(`Missing required field: ${field}`);
  }

  return number;
}

export function parseFlood(row) {
  const objectid = optionalBigInt(row.OBJECTID);

  if (objectid === undefined) {
    throw new Error("Missing OBJECTID");
  }

  return {
    objectid,
    latitudeDd: requiredNumber(row.latitude_dd, "latitude_dd"),
    longitudeDd: requiredNumber(row.longitude_dd, "longitude_dd"),

    eventName: row.eventName ?? "",
    hwmTypeName: row.hwmTypeName ?? "",
    hwmQualityName: row.hwmQualityName ?? "",
    verticalDatumName: row.verticalDatumName ?? "",
    verticalMethodName: row.verticalMethodName ?? "",
    horizontalMethodName: row.horizontalMethodName ?? "",
    horizontalDatumName: row.horizontalDatumName ?? "",

    siteNo: optionalString(row.site_no),
    siteDescription: optionalString(row.siteDescription),
    countyName: optionalString(row.countyName),
    siteZone: optionalString(row.siteZone),
    sitePermHousing: optionalString(row.sitePermHousing),

    hwmId: optionalBigInt(row.hwm_id),
    waterbody: optionalString(row.waterbody),
    siteId: optionalBigInt(row.site_id),
    eventId: optionalBigInt(row.event_id),
    hwmTypeId: optionalBigInt(row.hwm_type_id),
    hwmQualityId: optionalBigInt(row.hwm_quality_id),

    hwmLocationdescription: optionalString(row.hwm_locationdescription),
    surveyDate: optionalString(row.survey_date),
    elevFt: optionalNumber(row.elev_ft),
    bank: optionalString(row.bank),
    markerId: optionalBigInt(row.marker_id),
    heightAboveGnd: optionalNumber(row.height_above_gnd),
    hwmEnvironment: optionalString(row.hwm_environment),
    hwmLabel: optionalString(row.hwm_label),

    surveyDateTimestamp: row.SurveyDate?.trim() ?? "",
  };
}

export async function loadFloodCsv() {
  const response = await fetch("/floods.csv");

  if (!response.ok) {
    throw new Error(`Failed to load CSV: ${response.status}`);
  }

  const text = await response.text();

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message);
  }

  const rows = parsed.data.filter((row) => Boolean(row.OBJECTID?.trim()));

  const ids = new Set();

  for (const row of rows) {
    const id = row.OBJECTID.trim();

    if (ids.has(id)) {
      throw new Error(`Duplicate OBJECTID: ${id}`);
    }

    ids.add(id);
    parseFlood(row);
  }

  return rows;
}

export function connectSpacetimeDB(
  onConnected,
  onDisconnected,
  onError,
) {
  return DbConnection.builder()
    .withUri(DB_URI)
    .withDatabaseName(DB_NAME)
    .onConnect((ctx) => {
      onConnected(ctx);
    })
    .onDisconnect(() => {
      onDisconnected();
    })
    .onConnectError((_ctx, error) => {
      onError(error instanceof Error ? error : new Error(String(error)));
    })
    .build();
}

export function getExistingFloodIds(connection) {
  return new Set(
    [...connection.db.floodData.iter()].map((flood) =>
      flood.objectid.toString(),
    ),
  );
}

export function getResumeIndex(
  rows,
  existingIds,
) {
  let index = 0;

  while (index < rows.length && existingIds.has(rows[index].OBJECTID.trim())) {
    index++;
  }

  return index;
}

export async function insertFlood(
  connection,
  row,
) {
  await connection.reducers.createFlood(parseFlood(row));
}

export async function deleteAllFloods(connection) {
  const ids = [...connection.db.floodData.iter()].map(
    (flood) => flood.objectid,
  );

  for (const objectid of ids) {
    await connection.reducers.deleteFlood({ objectid });
  }
}
