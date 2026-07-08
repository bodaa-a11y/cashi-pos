$connectionString = "Data Source=.\sqlexpress;Initial Catalog=RPOS_DB;Integrated Security=True;MultipleActiveResultSets=True"
$connection = New-Object System.Data.SqlClient.SqlConnection
$connection.ConnectionString = $connectionString

try {
    $connection.Open()
    Write-Host "✅ Connected successfully to RPOS_DB!"
    
    # Get all tables
    $command = $connection.CreateCommand()
    $command.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($command)
    $dataset = New-Object System.Data.DataSet
    $adapter.Fill($dataset) | Out-Null
    
    Write-Host "Tables in database:"
    foreach ($row in $dataset.Tables[0].Rows) {
        Write-Host " - $($row.TABLE_NAME)"
    }
} catch {
    Write-Error "❌ Connection failed: $_"
} finally {
    $connection.Close()
}
