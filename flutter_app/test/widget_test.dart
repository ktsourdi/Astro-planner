import 'package:flutter_test/flutter_test.dart';
import 'package:astro_planner_mobile/main.dart';

void main() {
  testWidgets('app boots with setup title', (tester) async {
    await tester.pumpWidget(const AstroPlannerApp());
    expect(find.text('Astro Planner Setup'), findsOneWidget);
  });
}
