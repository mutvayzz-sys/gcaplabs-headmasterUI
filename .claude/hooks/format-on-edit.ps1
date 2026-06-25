$json = [Console]::In.ReadToEnd()
$f = ($json | ConvertFrom-Json).tool_input.file_path
if ($f) { & bunx oxfmt $f 2>$null }
exit 0
