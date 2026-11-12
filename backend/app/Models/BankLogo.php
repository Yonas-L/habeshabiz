<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $category
 * @property string|null $name
 * @property string $logo_url
 * @property int $sort_order
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class BankLogo extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'bank_logos';

    protected $fillable = [
        'category',
        'name',
        'logo_url',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];
}
