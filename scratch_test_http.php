<?php

use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);

$user = User::first();
Auth::login($user);

$request = Request::create('/dashboard/documents/transactions/TRX-2563H9EP53/pdf/shipping', 'GET');
$response = $kernel->handle($request);

echo 'Status: '.$response->getStatusCode()."\n";
if ($response->getStatusCode() == 500) {
    if (isset($response->exception) && $response->exception) {
        echo 'Exception: '.$response->exception->getMessage().' at '.$response->exception->getFile().':'.$response->exception->getLine()."\n";
    } else {
        echo 'Response: '.substr($response->getContent(), 0, 500)."\n";
    }
}
