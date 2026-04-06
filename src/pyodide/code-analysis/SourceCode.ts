
export default class SourceCode {

    public readonly content: string;
    public readonly lines: string[];

    constructor(content: string) {
        this.content = content;
        this.lines = content.split('\n');
    }

};
