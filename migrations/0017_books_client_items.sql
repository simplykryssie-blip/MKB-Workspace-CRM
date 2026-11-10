-- "Client Entry in Progress" → "Waiting on Client Items": MKB does the bookkeeping;
-- the client's part each month is bank feeds, receipts and notes on cash or
-- unusual activity. Renames the stage wherever it is stored and rewords the
-- monthly client tasks already created with the old wording.
UPDATE books_workspaces SET months = replace(months, '"Client Entry in Progress"', '"Waiting on Client Items"') WHERE months LIKE '%Client Entry in Progress%';
UPDATE client_enrollments SET stage = 'Waiting on Client Items' WHERE stage = 'Client Entry in Progress';
UPDATE books_workspaces SET tasks =
  replace(replace(replace(replace(replace(replace(tasks,
    ' transactions in QuickBooks","detail":"Add or match every bank and card transaction for the month."', ' bank and card feeds connected in QuickBooks","detail":"Make sure every account in your plan is connected so transactions download. Tell us if a bank stops syncing."'),
    '"type":"entry","title":"Enter all ', '"type":"entry","title":"Keep your '),
    ' transactions","detail":"Clear the ''For review'' list and Uncategorized accounts."', ' receipts and notes","detail":"Upload receipts for business purchases and tell us about cash or other activity that didn''t go through the bank."'),
    '"type":"categorize","title":"Categorize outstanding ', '"type":"categorize","title":"Send your '),
    ' for MKB review","detail":"Confirm your entries are complete."', ' is ready","detail":"Confirm your feeds, receipts and notes are in so we can start your review."'),
    '"type":"submit","title":"Submit ', '"type":"submit","title":"Let MKB know ')
WHERE tasks LIKE '%Enter all %' OR tasks LIKE '%Categorize outstanding %' OR tasks LIKE '%Confirm your entries are complete.%';
