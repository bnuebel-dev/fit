package me.nuebel.fit.health

import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.metadata.Device
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Energy
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId

/**
 * Schreibt abgeschlossene Trainings nach Health Connect (Übungseinheit "Krafttraining" plus aktive Kalorien).
 * Fit liest nichts aus Health Connect. Mit einer festen clientRecordId wird ein erneut gesendetes Training aktualisiert statt verdoppelt.
 */
@CapacitorPlugin(name = "FitHealth")
class FitHealthPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val writePermissions = setOf(
        HealthPermission.getWritePermission(ExerciseSessionRecord::class),
        HealthPermission.getWritePermission(ActiveCaloriesBurnedRecord::class),
    )

    private fun availability(): String = when (HealthConnectClient.getSdkStatus(context)) {
        HealthConnectClient.SDK_AVAILABLE -> "available"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update-required"
        else -> "unavailable"
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val result = JSObject().put("availability", availability())
        if (availability() != "available") {
            call.resolve(result.put("granted", false))
            return
        }
        scope.launch {
            try {
                val granted = HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
                result.put("granted", granted.containsAll(writePermissions))
                result.put("grantedList", granted.joinToString(", ") { it.substringAfterLast('.') })
                call.resolve(result)
            } catch (e: Throwable) {
                call.reject("${e.javaClass.simpleName}: ${e.message}", e as? Exception)
            }
        }
    }

    @PluginMethod
    fun requestAccess(call: PluginCall) {
        if (availability() != "available") {
            call.reject("Health Connect is not available")
            return
        }
        val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, writePermissions)
        startActivityForResult(call, intent, "permissionResult")
    }

    @ActivityCallback
    private fun permissionResult(call: PluginCall?, @Suppress("UNUSED_PARAMETER") result: ActivityResult) {
        if (call == null) return
        scope.launch {
            try {
                val granted = HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
                call.resolve(JSObject().put("granted", granted.containsAll(writePermissions)))
            } catch (e: Throwable) {
                call.reject("${e.javaClass.simpleName}: ${e.message}", e as? Exception)
            }
        }
    }

    @PluginMethod
    fun writeWorkout(call: PluginCall) {
        val id = call.getString("id")
        val title = call.getString("title") ?: "Fit"
        val start = call.getDouble("start")
        val end = call.getDouble("end")
        val kcal = call.getDouble("kcal") ?: 0.0
        if (id == null || start == null || end == null || end <= start) {
            call.reject("id, start and end (epoch ms, end after start) are required")
            return
        }
        if (availability() != "available") {
            call.reject("Health Connect is not available")
            return
        }
        scope.launch {
            try {
                val startAt = Instant.ofEpochMilli(start.toLong())
                val endAt = Instant.ofEpochMilli(end.toLong())
                val offset = ZoneId.systemDefault().rules.getOffset(startAt)
                val version = System.currentTimeMillis()
                val records = mutableListOf<androidx.health.connect.client.records.Record>(
                    ExerciseSessionRecord(
                        startTime = startAt, startZoneOffset = offset, endTime = endAt, endZoneOffset = offset,
                        metadata = Metadata.activelyRecorded(device = Device(type = Device.TYPE_PHONE), clientRecordId = "fit-$id", clientRecordVersion = version),
                        exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
                        title = title,
                    ),
                )
                if (kcal > 0) {
                    records.add(
                        ActiveCaloriesBurnedRecord(
                            startTime = startAt, startZoneOffset = offset, endTime = endAt, endZoneOffset = offset,
                            energy = Energy.kilocalories(kcal),
                            metadata = Metadata.activelyRecorded(device = Device(type = Device.TYPE_PHONE), clientRecordId = "fit-$id-kcal", clientRecordVersion = version),
                        ),
                    )
                }
                HealthConnectClient.getOrCreate(context).insertRecords(records)
                call.resolve()
            } catch (e: Throwable) {
                call.reject("${e.javaClass.simpleName}: ${e.message}", e as? Exception)
            }
        }
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        try {
            activity.startActivity(Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS))
            call.resolve()
        } catch (e: Exception) {
            call.reject(e.message ?: "cannot open Health Connect", e)
        }
    }
}
