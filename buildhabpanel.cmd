call mvn package -o -pl :org.openhab.ui.habpanel -DskipChecks -DskipTests
echo "[INFO] copy target to O:"
copy .\bundles\org.openhab.ui.habpanel\target\*-SNAPSHOT.jar O:\openhab-addons
echo [DONE] 
