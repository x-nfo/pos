<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$user = App\Models\User::first();
\Illuminate\Support\Facades\Auth::login($user);

$request = Illuminate\Http\Request::create('/dashboard/documents/transactions/TRX-2563H9EP53/pdf/shipping', 'GET');
$response = $kernel->handle($request);

echo "Status: " . $response->getStatusCode() . "\n";
if ($response->getStatusCode() == 500) {
    if (isset($response->exception) && $response->exception) {
        echo "Exception: " . $response->exception->getMessage() . " at " . $response->exception->getFile() . ":" . $response->exception->getLine() . "\n";
    } else {
        echo "Response: " . substr($response->getContent(), 0, 500) . "\n";
    }
}
