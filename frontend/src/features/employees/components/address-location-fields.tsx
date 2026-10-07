"use client"

import { useMemo } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { Country, State, City } from "country-state-city"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchSelect } from "@/components/ui/search-select"
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { OTHER_CITY } from "@/features/employees/constants"

/**
 * Country → State → City, from the `country-state-city` dataset.
 *
 * NAMES are stored, not ISO codes: the three columns are free text and were
 * free text before these dropdowns existed, so every address already on file
 * holds a name. Writing codes would make the new rows unreadable next to the
 * old ones. The codes are looked up on the way in instead.
 */
const COUNTRIES = Country.getAllCountries()

/** Every employee is in India; the Country field offers nothing else. */
export const DEFAULT_COUNTRY = "India"

function isoForCountry(name: string) {
  return COUNTRIES.find((c) => c.name === name)?.isoCode ?? null
}

function statesOf(countryName: string) {
  const iso = isoForCountry(countryName)
  return iso ? State.getStatesOfCountry(iso) : []
}

function citiesOf(countryName: string, stateName: string) {
  const countryIso = isoForCountry(countryName)
  if (!countryIso) return []
  const stateIso = State.getStatesOfCountry(countryIso).find((st) => st.name === stateName)?.isoCode
  return stateIso ? City.getCitiesOfState(countryIso, stateIso) : []
}

/** The four form fields this block reads and writes. */
interface LocationFieldValues {
  country?: string
  state?: string
  city?: string
  /** Only used when city is "Other". */
  cityOther?: string
}

/**
 * The Country, State and City pickers (plus the free-text box behind "Other"),
 * shared by the HR employee form and the employee's own Edit my details panel.
 *
 * Renders three grid cells and no wrapper, so the caller places them in its
 * own grid next to the postal code. `idPrefix` names them —
 * `employee-country` and so on — which the employee form's reportInvalid
 * relies on to scroll to a failing dropdown.
 */
export function AddressLocationFields<T extends LocationFieldValues>({
  form,
  savedCountry,
  idPrefix,
}: {
  form: UseFormReturn<T>
  /** The country already on file, kept as an option — see countryOptions. */
  savedCountry?: string | null
  idPrefix: string
}) {
  // Every form passed in carries these four string fields; react-hook-form's
  // path types just can't see that through a generic, hence the one cast.
  const f = form as unknown as UseFormReturn<LocationFieldValues>

  // Each list depends on the one above it, so they are derived from the
  // watched values rather than held in state — there is no version of these
  // lists that isn't a function of the current choice.
  // useWatch rather than form.watch, so this block re-renders on its own
  // fields' changes whatever its parent memoizes.
  const selectedCountry = useWatch({ control: f.control, name: "country" }) ?? ""
  const selectedState = useWatch({ control: f.control, name: "state" }) ?? ""
  const selectedCity = useWatch({ control: f.control, name: "city" }) ?? ""

  // India only. An existing record naming another country keeps it as an
  // option, so opening the form doesn't silently rewrite their address.
  const countryOptions = useMemo(
    () => [
      { value: DEFAULT_COUNTRY, label: DEFAULT_COUNTRY },
      ...(savedCountry && savedCountry !== DEFAULT_COUNTRY ? [ { value: savedCountry, label: savedCountry } ] : []),
    ],
    [savedCountry]
  )
  const stateOptions = useMemo(
    () => statesOf(selectedCountry).map((st) => ({ value: st.name, label: st.name })),
    [selectedCountry]
  )
  const cityOptions = useMemo(
    () => [
      ...citiesOf(selectedCountry, selectedState).map((c) => ({ value: c.name, label: c.name })),
      // Always last, and always offered: the dataset is large but not complete,
      // and an address nobody can enter is worse than a free-text box.
      { value: OTHER_CITY, label: "Other (type it in)" },
    ],
    [selectedCountry, selectedState]
  )

  // Country first, then State, then City: each list is derived from the one
  // above it, so choosing out of order would offer nothing. Changing a level
  // clears the levels below rather than leaving a city that no longer belongs
  // to its state.
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-country`}>Country</Label>
        <SearchSelect
          id={`${idPrefix}-country`}
          aria-label="Country"
          options={countryOptions}
          value={selectedCountry || null}
          onChange={(next) => {
            f.setValue("country", next ?? DEFAULT_COUNTRY)
            f.setValue("state", "")
            f.setValue("city", "")
            f.setValue("cityOther", "")
          }}
          placeholder="Select a country"
          searchPlaceholder="Search countries…"
          emptyMessage="No country matches that search."
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-state`}>State</Label>
        <SearchSelect
          id={`${idPrefix}-state`}
          aria-label="State"
          options={stateOptions}
          value={selectedState || null}
          onChange={(next) => {
            f.setValue("state", next ?? "")
            f.setValue("city", "")
            f.setValue("cityOther", "")
          }}
          clearable
          placeholder={selectedCountry ? "Select a state" : "Choose a country first"}
          searchPlaceholder="Search states…"
          emptyMessage="No state matches that search."
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-city`}>City</Label>
        <SearchSelect
          id={`${idPrefix}-city`}
          aria-label="City"
          options={cityOptions}
          value={selectedCity || null}
          onChange={(next) => {
            f.setValue("city", next ?? "")
            if (next !== OTHER_CITY) f.setValue("cityOther", "")
          }}
          clearable
          placeholder={selectedState ? "Select a city" : "Choose a state first"}
          searchPlaceholder="Search cities…"
          emptyMessage="No city matches that search."
        />
        {selectedCity === OTHER_CITY && (
          <FormField
            control={f.control}
            name="cityOther"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input {...field} placeholder="Type the city name" aria-label="City name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </>
  )
}
