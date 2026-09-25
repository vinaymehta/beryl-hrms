class AddEmailContextToNotifications < ActiveRecord::Migration[8.1]
  def change
    # The labelled lines the email shows under the message — "Cycle", "Employee",
    # "Action required" and so on. Stored on the notification rather than
    # rebuilt in the mailer because only the event knows what its context is,
    # and the mailer is deliberately generic so no event can ship without one.
    #
    # An ARRAY of pairs, not a hash: the order these appear in is editorial,
    # and a hash would leave it to chance.
    add_column :notifications, :email_context, :jsonb, default: [], null: false
  end
end
