module Mail
  # One set of walk limits shared by everything that answers a Mail date
  # filter — the message list (Mail::DateFilteredMessages) and the KPI
  # counts (Mail::ScopedStats). They MUST agree: when the two used
  # different caps, a wide range (e.g. Last Year) made the list report
  # "100" while the cards reported "200+" for the very same filter.
  #
  # Zoho exposes no way to count or filter by date server-side, so a range
  # is answered by walking pages newest-first and stopping once a page is
  # entirely older than the range. These bound that walk; hitting either
  # one means "at least this many", surfaced through the capped flags.
  module ScanBounds
    MAX_PAGES = 20
    # Sized so one request typically reaches back past a normal window and
    # the early stop fires immediately. Bigger is not better: a Zoho round
    # trip costs ~1.1s at 100 but ~1.6s at 200, and with the oldest-message
    # stop condition the extra reach buys nothing — 100 already ends the
    # walk on the first page for the usual ranges.
    PAGE_SIZE = 100
    MAX_RESULTS = 200
  end
end
