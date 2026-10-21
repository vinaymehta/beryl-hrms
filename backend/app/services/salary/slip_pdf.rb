require "prawn"
require "prawn/table"

# Known and handled — see Appraisals::LetterPdf, which sets the same.
Prawn::Fonts::AFM.hide_m17n_warning = true

module Salary
  # One employee's salary slip for one month, as PDF bytes.
  #
  #   SlipPdf.call(employee: employee, breakdown: decision.breakdown, month: Date.new(2026, 9, 1))
  #
  # Laid out after the company's own pay slip: one bordered box of four
  # columns (label | value | label | value), ruled like the original — no
  # lines between the detail rows or between the earnings rows, only the box,
  # the divider down the middle and the lines around each section —
  #
  #   logo · LEGAL NAME / address lines / phone
  #   Pay Slip For The Month of October 2025
  #   the employee's details, two per row
  #   Earnings | Deductions, each a Description / Amt (Rs.) pair
  #   Gross Pay | Gross Deductions
  #   Net Amount Pay, in words
  #
  # Everything the format decides lives in this class — the rest of the app
  # only calls `call`, `amounts`, `filename` and `period`.
  #
  # Built-in Helvetica, like Appraisals::LetterPdf, so amounts are written
  # "Rs." and names outside Windows-1252 are transliterated (see #safe).
  class SlipPdf
    FONT = "Helvetica".freeze
    FONT_SIZE = 9
    MARGIN = 36
    LOGO_WIDTH = 50
    # Label, value, label, value. The label columns fit the longest label
    # ("Subscription Status to PF:", "INCOME TAX DEDUCATION"); the rest of
    # the page width goes to the two value columns.
    LABEL_WIDTH = 140
    # Every value nobody has given: a missing PAN, location or account.
    BLANK = "--".freeze

    # The bank behind an IFSC's first four letters, by the short name the slip
    # prints before the account number ("ICICI-779401501148"). A code not in
    # the list prints as its four letters.
    BANKS = {
      "ICIC" => "ICICI", "HDFC" => "HDFC", "SBIN" => "SBI", "UTIB" => "AXIS", "KKBK" => "KOTAK",
      "PUNB" => "PNB", "BARB" => "BOB", "CNRB" => "CANARA", "UBIN" => "UNION", "IDIB" => "INDIAN",
      "YESB" => "YES", "INDB" => "INDUSIND", "IDFB" => "IDFC FIRST", "FDRL" => "FEDERAL", "BKID" => "BOI",
      "MAHB" => "BOM", "CBIN" => "CENTRAL", "IOBA" => "IOB", "UCBA" => "UCO", "PSIB" => "PSB",
      "SIBL" => "SIB", "KVBL" => "KVB", "CIUB" => "CUB", "DBSS" => "DBS", "AUBL" => "AU",
      "ESFB" => "EQUITAS", "RATN" => "RBL", "BDBL" => "BANDHAN"
    }.freeze

    def self.call(...) = new(...).call

    # "September 2026", as the slip, the subject line and the page say it.
    def self.period(month) = month.strftime("%B %Y")

    def self.filename(employee, month)
      "Salary-slip-#{month.strftime('%Y-%m')}-#{employee.employee_code.to_s.parameterize}.pdf"
    end

    # `breakdown` is the monthly rows keyed as Appraisals::SalaryStructure::KEYS;
    # `month` any date in the month the slip is for.
    def initialize(employee:, breakdown:, month:)
      @employee = employee
      @breakdown = breakdown.to_h.stringify_keys
      @month = month.beginning_of_month
      @company = employee.company
    end

    def call
      pdf = Prawn::Document.new(page_size: "A4", margin: MARGIN, info: document_info)
      pdf.font(FONT, size: FONT_SIZE)

      value_width = (pdf.bounds.width - (2 * LABEL_WIDTH)) / 2
      # Inclusive ranges: Prawn's rows() reads a Range by its first and last
      # value, so an exclusive `a...b` would take in row b as well.
      first_detail = header_rows.size
      details = first_detail..(first_detail + detail_rows.size - 1)
      # After the details: two heading rows (Earnings | Deductions, then
      # Description | Amt), then one row per earning, then the Gross row.
      first_item = details.last + 3
      items = first_item..(first_item + pay_item_count - 1)

      pdf.table(header_rows + detail_rows + pay_rows,
                width: pdf.bounds.width,
                column_widths: [ LABEL_WIDTH, value_width, LABEL_WIDTH, value_width ],
                cell_style: { size: FONT_SIZE, padding: [ 3, 6 ], border_width: 0.75, border_color: "000000",
                              valign: :center }) do |table|
        # The details read as two columns of pairs: the box sides and one
        # divider down the middle, values centred under each other.
        table.rows(details).borders = []
        table.rows(details).column(0).borders = [ :left ]
        table.rows(details).column(1).borders = [ :right ]
        table.rows(details).column(3).borders = [ :right ]
        table.rows(details).columns([ 1, 3 ]).align = :center
        # The earnings and deductions lists: a rule between the columns, none
        # between the rows.
        table.rows(items).borders = %i[left right]
      end

      pdf.render
    end

    # The three totals the slip prints, without rendering it — what
    # SalarySlip stores and the Salary page shows, so the page and the PDF
    # can never disagree.
    def amounts = { gross: gross_pay, deductions: gross_deductions, net: net_pay }

    def gross_pay = earnings.sum { |_, value| value }

    def gross_deductions = deductions.sum { |_, value| value }

    def net_pay = gross_pay - gross_deductions

    private
      def document_info
        {
          Title: safe("Pay slip — #{period} — #{@employee.full_name}"),
          Author: safe(legal_name),
          Creator: "#{MailBranding::NAME} HRMS",
          CreationDate: Time.current
        }
      end

      # --- The grid, top to bottom -------------------------------------------

      # The letterhead — logo, then the legal name over the address and phone,
      # one box with no rule between the two — and the slip's title under it.
      def header_rows
        lines = [ "<b>#{escape(legal_name.upcase)}</b>" ]
        lines += @company.address.to_s.lines.map(&:strip).compact_blank.map { |line| escape(line) }
        lines << escape(@company.phone.strip) if @company.phone.present?
        # The name and address sit in the right half, left-aligned, the logo
        # on the left — as on the company's slip.
        letterhead = { content: lines.join("\n"), colspan: 2, align: :left, inline_format: true,
                       borders: %i[top right bottom], padding: [ 8, 6 ], leading: 2, size: FONT_SIZE + 1 }

        logo = MailBranding.logo_path
        logo_cell = if File.exist?(logo)
          { image: logo.to_s, image_width: LOGO_WIDTH, position: :left, vposition: :center,
            colspan: 2, borders: %i[top left bottom], padding: [ 8, 12 ] }
        else
          { content: "", colspan: 2, borders: %i[top left bottom] }
        end

        [
          [ logo_cell, letterhead ],
          [ { content: "Pay Slip For The Month of #{period}", colspan: 4, align: :center } ]
        ]
      end

      def detail_rows
        [
          [ "Name:", @employee.full_name, "Location", @employee.work_location.presence || BLANK ],
          [ "Emp Code:", @employee.employee_code.to_s, "Month", @month.strftime("%b-%y") ],
          [ "PAN No.", @employee.pan_number.presence || BLANK, "Payable Days", @month.end_of_month.day.to_s ],
          [ "Designation:", @employee.designation&.title.presence || BLANK, "Bank & A/c No.", bank_account ],
          [ "Subscription Status to PF:", BLANK, "PF A/c No.", BLANK ]
        ].map { |row| row.map { |cell| safe(cell) } }
      end

      # Earnings on the left, deductions beside them on the same rows — the
      # shorter list leaves its last rows blank — then the two totals and the
      # net in words.
      def pay_rows
        rows = [
          [ heading("Earnings", colspan: 2), heading("Deductions", colspan: 2) ],
          [ "Description", heading("Amt (Rs.)"), "Description", heading("Amt (Rs.)") ]
        ]
        pay_item_count.times do |index|
          rows << pay_pair(earnings[index]) + pay_pair(deductions[index])
        end
        rows << [ "Gross Pay", amount_cell(gross_pay), "Gross Deductions", amount_cell(gross_deductions) ]
        rows << [ heading("Net Amount Pay"),
                  { content: "Rs #{AmountInWords.call(net_pay)} Only", colspan: 3, align: :center } ]
      end

      def pay_item_count = [ earnings.size, deductions.size ].max

      def pay_pair(row)
        return [ "", "" ] if row.nil?

        label, value = row
        [ label, amount_cell(value) ]
      end

      def heading(text, colspan: 1) = { content: text, colspan: colspan, align: :center }

      def amount_cell(value) = { content: amount(value), align: :center }

      # --- Data ---------------------------------------------------------------

      # The slip's own rows, mapped from the appraisal letter's breakdown. The
      # letter has no medical reimbursement or LTA, so those print as 0; its
      # Incentive has no row of its own here and is paid under Others.
      def earnings
        @earnings ||= [
          [ "Basic", component("basic") ],
          [ "HRA", component("hra") ],
          [ "Conv", component("conveyance") ],
          [ "Special Allowance", component("special_allowance") ],
          [ "Medi. Reimb.", BigDecimal("0") ],
          [ "LTA", BigDecimal("0") ],
          [ "Others", component("others") + component("incentive") ]
        ]
      end

      # Only the employee's EPF is taken from the breakdown — the employer's is
      # the company's cost, not a deduction from pay. Nothing else is recorded
      # yet, so the other rows are 0 ("DEDUCATION" is the company's spelling).
      def deductions
        @deductions ||= [
          [ "PF CONTRIBUTION", component("epf_employee") ],
          [ "ESI CONTRIBUTION", BigDecimal("0") ],
          [ "INCOME TAX DEDUCATION", BigDecimal("0") ],
          [ "ADVANCES RECOVERY", BigDecimal("0") ],
          [ "OTHER DEDUCTIONS", BigDecimal("0") ]
        ]
      end

      def component(key) = Appraisals::SalaryStructure.decimal(@breakdown[key])

      # "ICICI-779401501148": the bank's short name from the IFSC, then the
      # account number. Just the number without an IFSC; "--" without either.
      def bank_account
        number = @employee.bank_account_number.presence
        return BLANK if number.nil?

        code = @employee.bank_ifsc_code.to_s.first(4).upcase
        code.present? ? "#{BANKS.fetch(code, code)}-#{number}" : number
      end

      def period = self.class.period(@month)

      def legal_name = @company.letter_legal_name

      # Indian grouping, always with paise: 30,750.00 · 1,23,456.00 · 0.00.
      def amount(value)
        value = value.round(2)
        rupees = value.abs.truncate
        paise = ((value.abs - rupees) * 100).round.to_i
        "#{'-' if value.negative?}#{Appraisals::SalaryStructure.format_amount(rupees)}.#{paise.to_s.rjust(2, '0')}"
      end

      # For a cell written with inline formatting, where Prawn would read a
      # "<" or "&" in an address as markup. It decodes exactly these three.
      def escape(text) = safe(text).gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;")

      # Helvetica's built-in encoding is Windows-1252; a name outside it would
      # make Prawn raise mid-slip, so it is transliterated instead.
      def safe(text)
        text = text.to_s
        text.encode("Windows-1252")
        text
      rescue Encoding::UndefinedConversionError
        I18n.transliterate(text)
      end
  end
end
