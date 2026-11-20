[00:00] Now let's get started with Update Teacher's RPC.
[00:26] All right, so in update teachers, we are simply updating value into the database. So the first thing that we do is call
[00:55] MongoDB.createMongoClient and let's handle the return values
[01:24] All right so now in the request we have received a list of teachers so obviously we are going to loop over the teachers and this is going to be
[01:52] teacher and this is going to be rec.teachers now before we loop over the teachers that we have received in the request we also need a list in which we are going to store the teachers that have been updated so let's create a new variable
[02:19] and it's a list of type pb.teachers because this is the return value. All right now the first thing that we need to do is we need to convert the teacher that we have received in the request into a model type the model.teacher type.
[02:45] So for that we call MongoDB. Alright, so we actually haven't... Alright, so we actually haven't exported these functions and we actually don't need to. Let me first delete this.
[03:10] and we actually don't need to export this because we are going to extract the database functionality into this file but initially we need to export these so let's capitalize the first alphabet
[03:33] correct these as well and now I can call MongoDB dot map PB teacher to model teacher and to this I'm going to pass the teacher
[03:58] And this returns us a model teacher. So let's create a variable and save that. And now before updating the value we need to convert the teacher ID into an ID that is acceptable by MongoDB. So for that we call primitive dot object ID from hex. And pass it the teacher dot ID.
[04:27] and this is going to return us the object ID comma error
[04:46] All right, now let's call the function to update the value. So let's call client.database and then the collection.
[05:12] And finally update one. First argument is context, so CTX and the next argument is filter. So we need to filter by an object ID. We just need one entry to update the value.
[05:34] and we need to find that entry by using the ID of the entry ID of the document. So now we pass it the key and value. The key is underscore ID. The value is object ID. Alright, this is the filter. Next, we need the update value. Alright, now this is going to be
[06:02] Beeson.m again. And now the key will be the instructions. So it's going to be in double quotes and dollar set. And for that, we can also refer to the documentation of MongoDB. Here we see the command db.restra, so database.collectionname.restra and then .update1.
[06:31] And this is the filtering criteria. So any entry, any document with name central perk cafe and we need to set the value violations as three. So the key is violations, the value is three and the instruction is dollar set. So that is exactly what we are doing here. All right. So what do we need to use here? Because what we have here is model teacher, which is
[06:59] instance of models.teacher and that is not going to be accepted here. So what we do here is we convert the model teacher into a Beeson document first. And it's going to be a two-step process.
[07:24] First we need to change this model teacher into a byte slice and then that byte slice will be converted to bson.m. And now in order to convert model teacher into a byte slice we call bson.marshall and pass it the model teacher. And I'm going to call it model doc.
[07:54] and let's also handle the error. Alright, we see that this is a byte slice and we also have an error. So let's handle them both. And now that we have the byte slice ready,
[08:22] this time we are going to call bson.unmartial and this needs a by slice as its first argument so let's give it model doc and the second argument is the value that is going to hold the converted value and I'm going to have to declare the variable first so var update doc
[08:50] and now this is going to be of type besan.m. Let's pass that here by a pointer so m%UpdateDoc. Alright so now this is going to return an error so let's handle the error.
[09:13] All right. So now we are ready to pass this update doc here. But there is a problem. Let me bring up the teacher model. So now this update doc carries
[09:42] ID as well as these fields and what we update is only these fields. We never update the ID of a document, right? So right now we are actually trying to update the ID as well along with other fields of this struct. So what we need to do is we need to delete the ID field from update dog.
[10:10] and for that we have a simple fix so first I'm going to comment this and for this we have a simple fix we have a delete method
[10:37] and we call this delete method we pass the updateDoc and then we pass the key. So this delete method is available generally and this handles the maps and we know that bson.m is simply a map and that's why we can just pass updateDoc here and then give it a key to delete the key and value pair from this map. Alright so now we are updating the value here.
[11:04] and we know that it gives us a result as well as error and the result will contain the modified count and we don't need that because if there is an error that means that there was no update and if there is no error that means that the update operation went through successfully.
[11:29] and I'm going to use fmt.sprintf here and pass this. Alright so now we introduce another variable updated teacher and now we call MongoDB.map
[11:58] model teacher to PB and then pass the model teacher to this function. And once that is done then in that case we are going to append this value to updated teachers.
[12:19] and finally we are going to return this value to the client so return m%pb.teachers and the error is nil and I'm sorry it's not go for assignment it's it's just equal to symbol
[12:46] all right so this is actually pv.teacher let me correct this and let's also correct this this is sprintelen all right so our update teachers function is ready let's test this and for that we start the server
[13:15] and update teachers. Let's bring up an example and we need to get the ID from MongoDB Compass so let's do that. Copy MSID and we're going to change our first name.
[13:44] and let's send multiple values so let's also change Liam's name alright so Liam's name will be changed to John and Emma's first name
[14:12] let's change Emma's last name because we are changing Liam's first name so alright so now we have the values ready last name for Emma and first name for Liam and here we go
[14:39] Now ideally if you have a front-end then the request is not only going to contain just the last name but all the fields alright so the response will also contain all the fields so there's nothing to worry about this it's just that we are sending only one field here and that's why we are getting a response with only one field but if we have a front-end then all the fields are going to be sent with the request and hence we are going to receive a response with all the fields
[15:09] alright so now let's refactor our code and I'm going to rename this function to modify teachers in DB
[15:36] And let's copy this over to teacher's crud.
[15:54] and now let's hit ctrl s and take care of the errors.
[16:17] all right and now let's delete these return types because we don't need these these are unnecessary
[16:45] and now let's also fix our update teachers RPC
[17:15] you
[17:25] Alright, so now I'm not going to send the complete request to this function.
[17:53] I'm actually only going to send it the slice of PB dot teacher. And let's call this PB teachers. Save this and we're done.
[18:20] and save this as well after correction. Now let's take up an example where we are not sending an ID. Let's see what happens. So let me delete this. Alright so let's invoke this request.
[18:48] And now we have an error invalid ID in the provided hex string. It's not invalid ID. It's actually a blank ID. So we are getting an error response, but we should handle this case proactively. So what I mean is that I don't want this kind of request to be passed on to this function.
[19:14] and for that we need to check if teacher ID is blank and if it is blank then in that case we are going to send an error to the client.
[19:40] all right now let's restart the server and now let's send this request again
[20:06] And now we have an appropriate response. Great, and now we are done with the Update Teacher's RBC.
[20:14] you
