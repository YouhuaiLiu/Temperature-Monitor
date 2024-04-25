// This will contain an object that specifies how the sensor should work.
var g_sensorData = null;

// Used to determine mouse clicks.
var g_wasMousePressed = false;
var g_wasMouseClicked = false;

// Internal types for differentiating the search types.
function environmentType()
{
	return 'ENVIRONMENT';
}
function propertyType()
{
	return 'PROPERTY';
}

// Internal type to differentiate the slot write types.
function analogType()
{
	return 'ANALOG';
}
function customType()
{
	return 'CUSTOM';
}
function digitalType()
{
	return 'DIGITAL';
}

// Purpose:
// Update the sensor.  Send value as specified.
function updateSensor()
{
	updateMouseClick();	
	
	if(null !== g_sensorData)
	{
		var unprocessedValue;
		var value;
		var deviceIDS = [];
		
		// Handle an environment value sensor.
		if(environmentType() === g_sensorData.type)
		{
			unprocessedValue = Environment.get(g_sensorData.propertyName);
		}
		else if(propertyType() == g_sensorData.type)
		{
			if(null !== g_sensorData.searchData)
			{
				if((undefined !== g_sensorData.searchData.w) && (undefined !== g_sensorData.searchData.h))				
				{
					unprocessedValue = [];
					
					// Search an area.   
					var x = getX();
					var y = getY();

					if('CENTER' === g_sensorData.searchData.offset)
					{
						x = getCenterX();
						y = getCenterY();
						
						x -= (g_sensorData.searchData.w/2);
						y -= (g_sensorData.searchData.h/2);
					}
					else if('WORKSPACE' === g_sensorData.searchData.offset)
					{
						x = 0;
						y = 0;
					}
		
					// Search in a range around it.
					var objects = devicesAt(x, y, g_sensorData.searchData.w,  g_sensorData.searchData.h);
					
					
					var deviceProperty;
					
					unprocessedValue = [];
					for(var ind = 0; ind < objects.length; ++ind)
					{
						if(g_sensorData.searchData.deviceIDs.length > 0)
						{
							for(var name = 0; name < g_sensorData.searchData.deviceIDs.length; ++name)
							{
								if((objects[ind] === g_sensorData.searchData.deviceIDs[name]) && 
								   (null !== (deviceProperty = getDeviceProperty(objects[ind], g_sensorData.propertyName))))
								{
			
									unprocessedValue.push(deviceProperty);
		
									deviceIDS.push(objects[ind]);
									break;
								}
							}
						}
						else
						{
							deviceProperty = getDeviceProperty(objects[ind], g_sensorData.propertyName);
							if(0 !== deviceProperty.length)
							{
								unprocessedValue.push(deviceProperty);
								deviceIDS.push(objects[ind]);
							}
						}
					}
				}
			}
		}

		// If there was a value then handle it.
		if(undefined !== unprocessedValue)
		{
			value = processValue(unprocessedValue, deviceIDS);
			
			// Send the signal.
			if(g_sensorData.signalData)
			{
				if(analogType() === g_sensorData.signalData.type)
				{
					analogWrite(g_sensorData.signalData.slot, value);
				}
				else if(customType() === g_sensorData.signalData.type)
				{
					customWrite(g_sensorData.signalData.slot, value);
				}
				else if(digitalType() === g_sensorData.signalData.type)
				{
					digitalWrite(g_sensorData.signalData.slot, (value > 0) ? HIGH : LOW);
				}				
			}
		}
		
		g_sensorData.lastKnownValue = unprocessedValue;
		g_sensorData.lastProcessedValue = value;
	}
	
	// If set to handle the registration server, update it.	
	if(g_sensorData.updateRegistrationServer)	
		IoEClient.reportStates(g_sensorData.lastProcessedValue);
	
	// If set to handle the registration server, update it.	
	if(g_sensorData.updateRegistrationServer)	
		IoEClient.reportStates(g_sensorData.lastProcessedValue);	
		
	setDeviceProperty(getName(), "state", g_sensorData.lastProcessedValue);
	
	// Wait if specified.
	if(g_delayTime > 0)
		delay(g_delayTime);
}

// Purpose:
// Update mouse click detection and sets the internal flag to show if a click happened in the current update.
function updateMouseClick()
{
	g_wasMouseClicked = false;
	if(!g_wasMousePressed)
	{
		if(bMouseDown) // Global variable for when the button state is pressed (Alt+LeftClick).
			g_wasMouseClicked = true;
	}

	g_wasMousePressed = bMouseDown;	
}

// Purpose:
// Return if the mouse was last in a click state.  Value is true for click, false for not.
// This is only true for the first press, it counts as the click.
function getMouseClicked()
{
	return g_wasMouseClicked;
}

// Purpose:
// Sets the object up to detect and environment variable. 
// propertyName - The environment variable to get.
// signalData - Object that contains data for how to send a signal. Is it digital, analog, the slot.
function setupDetectEnvironment(propertyName, signalData)
{
	g_sensorData = {type: environmentType(), 
	                propertyName: propertyName,	
					signalData: signalData,
					lastProcessedValue: null,	// Store the last processed sensor value.
					lastKnownValue: null,		// Stores the last unprocessed sensor value.
					updateRegistrationServer: false // True to auto handle registration server updating.
	};
}

// Purpose:
// Sets the object up to detect a property in an script object. 
// propertyName - The property name to find.
// searchRange - Object that contains information on how the search should be conducted.  Just things in a range, specific names, etc.
// signalData - Object that contains data for how to send a signal. Is it digital, analog, the slot.
function setupDetectProperty(propertyName, searchData, signalData)
{
	g_sensorData = {type: propertyType(),
	                propertyName: propertyName,
	                searchData: searchData,
					signalData: signalData,
					lastProcessedValue: null,	// Store the last processed sensor value.
					lastKnownValue: null,		// Stores the last unprocessed sensor value.
					updateRegistrationServer: false // True to auto handle registration server updating.
	};
}

// Purpose:
// Creates and returns an object with information on how to search for device properties.
// deviceID - A single string.  The string would be a device name that should have it's property checked.
//         	   If you don't want it restriced to specific devices, just pass null.
// w, h      - Search area dimensions.  If you only want in a specific range around the sensor you would set the width and height.  Don't pass 
//         	   anything if the entire workspace should be searched.
// offset    - null or  'TOP_LEFT' if the top left corner is the starting point, 
//             'CENTER' if the search area should be around the center of the device.
//			   'WORKSPACE' if the entire workspace should be checked.  w and h will be ignored.
function createPropertySearch(deviceID, w, h, offset)
{
	if((undefined === w || undefined === h))
	{
		w = 4000;
		h = 4000;
		offset = 'WORKSPACE';
	}
	
	var search = {deviceIDs: [], w: w, h: h, offset: offset};
	if((null !== deviceID) && (undefined !== deviceID))
		search.deviceIDs[0] = deviceID;

	return search;
}

// Purpose:
// Creates and returns an object with information on how to search for device properties.
// deviceIDs - An array of strings.  Each string would be a device name that should have it's property checked.
//         	   If you don't want it restriced to specific devices, just pass null.
// w, h      - Search area dimensions.  If you only want in a specific range around the sensor you would set the width and height.  Don't pass 
//         	   anything if the entire workspace should be searched.
// offset    - null or  'TOP_LEFT' if the top left corner is the starting point, 
//             'CENTER' if the search area should be around the center of the device.
//			   'WORKSPACE' if the entire workspace should be checked.  w and h will be ignored.
function createPropertySearchDevices(deviceIDs, w, h, offset)
{
	if((undefined === w || undefined === h))
	{
		w = 4000;
		h = 4000;
		offset= 'WORKSPACE';
	}
	
	var search = {deviceIDs: [], w: w, h: h, offset: offset};
	if(null !== deviceIDs)
		 search.deviceIDs = deviceIDs;
	
	return search;
}


// Purpose:
// Creats and object that defines writting to an analog slot.
function createAnalogWrite(slot)
{
	return {type: analogType(), slot: slot};
}

// Purpose:
// Creats and object that defines writting to an analog slot.
function createCustomWrite(slot)
{
	return {type: customType(), slot: slot};
}

// Purpose:
// Creats and object that defines writting to an digital slot.
function createDigitalWrite(slot)
{
	return {type: digitalType(), slot: slot};
}

// Purpose:
// Returns the last update value before it was processed.
function getLastKnownValue()
{
	return g_sensorData.lastKnownValue;
}

// Purpose:
// Returns the last update value after it was processed.
function getLastProcessedValue()
{
	return g_sensorData.lastProcessedValue;
}

// Purpose:
// Setup a generic registration server entry for the sensor based on the slot write type the sensor is setup to use.
// If it is digital it will be true, false.
// Analog would be strings.
// Custom is not supported.
// The property will be marked as not-controllable and will only output values.
// sensorName, sensorProperty - The text that will be displayed in the registration server.
function setupRegistrationServer(sensorName, propertyName)
{
	if(g_sensorData)
	{
		g_sensorData.updateRegistrationServer = true;
		
		var sensorType;
		if(analogType() === g_sensorData.signalData.type)
			sensorType = 'number';
		else if(digitalType() === g_sensorData.signalData.type)
			sensorType = 'bool';
		else
		{
			g_sensorData.updateRegistrationServer = false;
			Serial.println('Slot type not applicable for registration');
		}
			
		if(g_sensorData.updateRegistrationServer)
		{
			IoEClient.setup({
			type: sensorName,
			states: [{
				name: propertyName,
				type: sensorType,
				controllable: false
			}]
			});
		}
	}
	else
	{
		Serial.println('Slot type not specified, cannot setup registration server');
	}
}
