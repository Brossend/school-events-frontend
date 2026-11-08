<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\CalendarEvent;
use App\Models\CulturalClaim;
use App\Models\EventSource;
use App\Models\School;
use App\Models\SchoolMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Run ONLY in app-test, copied to /tmp; backend source remains unchanged.
class Fe003ReadIsolationTest extends TestCase
{
    use DatabaseTransactions;

    public function test_foreign_school_source_and_claim_are_hidden(): void
    {
        $this->assertSame('testing', app()->environment());
        $this->assertSame('school_events_test', DB::connection()->getDatabaseName());
        $teacher = User::factory()->create();
        $school = School::create(['name' => 'FE003 School A', 'region_code' => '66', 'city' => 'A', 'inn' => '6670030001', 'settings' => []]);
        $other = School::create(['name' => 'FE003 School B', 'region_code' => '77', 'city' => 'B', 'inn' => '6670030002', 'settings' => []]);
        SchoolMembership::create(['school_id' => $school->id, 'user_id' => $teacher->id, 'role' => 'teacher', 'is_default' => true]);
        [$source, $claim] = $this->records('school_custom', $other->id, '77');
        $this->actingAs($teacher, 'web')->getJson('/api/v1/event-sources/'.$source->id, ['X-School-Id' => $school->id])->assertNotFound();
        $this->getJson('/api/v1/cultural-claims/'.$claim->id, ['X-School-Id' => $school->id])->assertNotFound();
        $this->getJson('/api/v1/event-sources/'.$source->id, ['X-School-Id' => $other->id])->assertForbidden();
    }

    public function test_foreign_region_source_claim_and_review_journal_are_denied(): void
    {
        $this->assertSame('school_events_test', DB::connection()->getDatabaseName());
        $curator = User::factory()->curator('regional', ['66'])->create();
        [$source, $claim] = $this->records('regional', null, '77');
        $this->actingAs($curator, 'web')->getJson('/api/v1/event-sources/'.$source->id)->assertNotFound();
        $this->getJson('/api/v1/cultural-claims/'.$claim->id)->assertNotFound();
        $this->getJson('/api/v1/event-sources/'.$source->id.'/reviews')->assertForbidden();
    }

    private function records(string $type, ?string $schoolId, string $region): array
    {
        $event = CalendarEvent::create(['title' => 'FE003 private fixture', 'event_type' => $type, 'region_code' => $region, 'school_id' => $schoolId, 'date_type' => 'fixed_annual', 'fixed_month' => 11, 'fixed_day' => 4, 'description' => 'Isolated test fixture', 'target_age_groups' => ['basic_5_9'], 'recommended_value_directions' => ['cultural_diversity'], 'status' => 'approved']);
        $source = EventSource::create(['calendar_event_id' => $event->id, 'title' => 'FE003 source', 'source_type' => 'scientific_publication']);
        $claim = CulturalClaim::create(['calendar_event_id' => $event->id, 'claim_text' => 'FE003 claim', 'culture_name' => 'FE003 culture', 'provenance_notes' => 'Isolated test evidence']);
        return [$source, $claim];
    }
}
