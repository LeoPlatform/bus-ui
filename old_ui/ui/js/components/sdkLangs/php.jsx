import React from 'react'
import {observer, inject} from 'mobx-react'
import CodeMirror from 'react-codemirror';

@inject('dataStore')
@observer
export default class Php extends React.Component {

    constructor(props) {
        super(props);
        this.dataStore = this.props.dataStore;
    }

    render() {
        let options = {
            lineNumbers: true,
        };
        let code = `$config = [\n\t"enableLogging" => false,\n\t"debug" => false,\n\t"kinesis"  => "${this.dataStore.sdkConfig.kinesis}",\n\t"firehose" => "${this.dataStore.sdkConfig.firehose}",\n\t"s3" => "${this.dataStore.sdkConfig.s3}"\n];`

        return (
            !code
                ? <div className="theme-spinner-large" />
                : (
                    <div>
                        <h1>PHP SDK</h1>
                        <div style={{width: '1000px'}}>
                            <CodeMirror value={code} options={options} />
                        </div>
                    </div>
                )
        )

    }
}